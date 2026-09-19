const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const coreRequire = createRequire(path.resolve(__dirname, '../../goobi-viewer-core/package.json'));
const { JSDOM } = coreRequire('jsdom');
const source = fs.readFileSync(
    path.resolve(__dirname, '../WebContent/resources/themes/reference/javascript/dev/custom.js'),
    'utf8'
);
const swiperSource = fs.readFileSync(
    path.resolve(
        __dirname,
        '../../goobi-viewer-core/src/main/resources/META-INF/resources/resources/javascript/libs/swiper/swiper-bundle.min.js'
    ),
    'utf8'
);

function setup(t) {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', {
        runScripts: 'outside-only',
        pretendToBeVisual: true,
    });
    const { window } = dom;
    t.after(() => window.close());
    const media = new window.EventTarget();
    media.matches = false;
    window.matchMedia = () => media;
    window.$ = () => ({ ready() {} });
    const styles = new Map();
    window.viewerJS = { slider: { set: (name, config) => styles.set(name, config) } };
    Object.defineProperties(window.HTMLElement.prototype, {
        offsetWidth: {
            configurable: true,
            get() {
                return parseFloat(this.style.width) || 0;
            },
        },
        clientWidth: {
            configurable: true,
            get() {
                return this.offsetWidth;
            },
        },
        offsetLeft: {
            configurable: true,
            get() {
                const index = this.parentElement ? [...this.parentElement.children].indexOf(this) : 0;
                return index * (this.offsetWidth + (parseFloat(this.style.marginRight || this.style.marginLeft) || 0));
            },
        },
    });
    window.eval(swiperSource);
    window.eval(source);

    function mount(count = 7, root, width = 1199) {
        if (!root) {
            root = window.document.createElement('section');
            root.className = 'cms-record-showcase';
            root.innerHTML = `<div class="swiper"><div class="swiper-wrapper"></div></div>
                <div class="cms-record-showcase__controls" hidden>
                    <div class="cms-record-showcase__progress"><input class="cms-record-showcase__scrubber" type="range" min="0" max="1000" value="0" aria-label="Auswahl durchsuchen"></div>
                    <button class="cms-record-showcase__step cms-record-showcase__step--prev" aria-label="Zurück"></button>
                    <button class="cms-record-showcase__step cms-record-showcase__step--next" aria-label="Weiter"></button>
                </div>`;
            window.document.body.append(root);
        }
        const el = root.querySelector('.swiper');
        el.style.cssText = `width: ${width}px; padding: 16px;`;
        const wrapper = root.querySelector('.swiper-wrapper');
        wrapper.innerHTML = Array.from(
            { length: count },
            (_, index) =>
                `<div class="swiper-slide" style="width:200px"><h3 class="slider-showcase__header">Objekt ${index + 1}</h3></div>`
        ).join('');
        const swiper = new window.Swiper(el, {
            ...styles.get('showcase').swiperConfig,
            height: 400,
            a11y: { prevSlideMessage: undefined, nextSlideMessage: undefined },
        });
        t.after(() => {
            if (!swiper.destroyed) swiper.destroy();
        });
        return {
            root,
            swiper,
            range: root.querySelector('input'),
            prev: root.querySelector('.cms-record-showcase__step--prev'),
            next: root.querySelector('.cms-record-showcase__step--next'),
            resize(width) {
                el.style.width = `${width}px`;
                swiper.emit('resize');
            },
            settle() {
                swiper.wrapperEl.dispatchEvent(new window.Event('transitionend'));
            },
        };
    }
    return { window, media, mount };
}

function assertCompletePage(fixture) {
    fixture.settle();
    const { swiper, range } = fixture;
    const position = swiper.rtlTranslate ? swiper.translate : -swiper.translate;
    const visible = swiper.slidesGrid
        .map((left, index) => ({ left, right: left + swiper.slidesSizesGrid[index] }))
        .filter(({ left, right }) => left < position + swiper.size - 0.01 && right > position + 0.01);
    assert.equal(visible.length, Math.min(swiper.params.slidesPerView, swiper.slides.length));
    visible.forEach(({ left, right }) => {
        assert.ok(left >= position - 0.01, 'the first visible record must be complete');
        assert.ok(right <= position + swiper.size + 0.01, 'the last visible record must be complete');
    });
    assert.equal(swiper.animating, false);
    assert.equal(Number(range.value), swiper.snapIndex);
    assert.ok(swiper.snapGrid.some((snap) => Math.abs(snap - position) < 0.01));
}

test('page navigation is local and retains translated accessible names', (t) => {
    const { mount } = setup(t);
    const first = mount();
    const second = mount();
    assert.equal(first.prev.disabled, true);
    assert.equal(first.prev.getAttribute('aria-label'), 'Zurück');
    assert.equal(first.next.getAttribute('aria-label'), 'Weiter');
    assert.equal(first.range.getAttribute('aria-valuetext'), '01–03 / 07');
    first.next.click();
    assert.equal(first.swiper.activeIndex, 3);
    assert.equal(first.swiper.animating, true);
    assert.equal(first.swiper.params.followFinger, true);
    assert.equal(first.swiper.wrapperEl.style.transitionDuration, '560ms');
    assert.equal(
        first.root
            .querySelector('.cms-record-showcase__progress')
            .style.getPropertyValue('--_showcase-transition-duration'),
        '560ms'
    );
    assert.equal(second.swiper.activeIndex, 0);
    assert.equal(second.range.getAttribute('aria-valuetext'), '01–03 / 07');
    assert.equal(first.root.querySelector('.slider-showcase__header').title, 'Objekt 1');
    assertCompletePage(first);
});

test('every arrow and scrubber page shows complete records at all five responsive sizes', (t) => {
    const { window, mount } = setup(t);
    for (const count of [1, 7, 15]) {
        for (const width of [390, 800, 1199, 1399, 1799]) {
            const fixture = mount(count, undefined, width);
            const { swiper, range, next, prev } = fixture;
            const last = swiper.snapGrid.length - 1;
            assert.equal(range.max, String(last));
            assert.equal(range.step, '1');
            assertCompletePage(fixture);
            for (let page = 1; page <= last; page++) {
                next.click();
                assert.equal(swiper.snapIndex, page, `next: ${count} records, width ${width}, page ${page}`);
                assertCompletePage(fixture);
            }
            assert.equal(next.disabled, true);
            for (let page = last - 1; page >= 0; page--) {
                prev.click();
                assert.equal(swiper.snapIndex, page);
                assertCompletePage(fixture);
            }
            assert.equal(prev.disabled, true);
            for (let page = 0; page <= last; page++) {
                range.value = page;
                range.dispatchEvent(new window.Event('input'));
                assert.equal(swiper.snapIndex, page);
                assertCompletePage(fixture);
            }
            if (last > 0) {
                range.value = '0.51';
                range.dispatchEvent(new window.Event('input'));
                assert.equal(swiper.snapIndex, 1);
                assertCompletePage(fixture);
            }
        }
    }
});

test('keyboard moves by complete pages and Home/End reach the full range', (t) => {
    const { window, mount } = setup(t);
    const fixture = mount();
    const { swiper, range } = fixture;
    const press = (key) => {
        range.dispatchEvent(new window.KeyboardEvent('keydown', { key, cancelable: true }));
        assertCompletePage(fixture);
    };
    press('ArrowRight');
    assert.equal(swiper.activeIndex, 3);
    press('PageDown');
    assert.ok(swiper.activeIndex > 1);
    press('End');
    assert.equal(swiper.progress, 1);
    press('Home');
    assert.equal(swiper.progress, 0);
});

test('resize keeps final pages aligned, locks fitting records and hides empty controls', (t) => {
    const { mount } = setup(t);
    const changing = mount(15);
    for (const width of [390, 639, 640, 959, 960, 1279, 1280, 1599, 1600, 1920, 390]) {
        changing.swiper.slideTo(14);
        changing.settle();
        changing.resize(width);
        assertCompletePage(changing);
        changing.swiper.slideTo(14);
        assertCompletePage(changing);
        assert.equal(changing.next.disabled, true, `last page after resize to ${width}`);
    }
    const fixture = mount(4, undefined, 1799);
    const { root, range, prev, next } = fixture;
    assert.equal(range.disabled, true);
    assert.equal(prev.disabled, true);
    assert.equal(next.disabled, true);
    assert.equal(root.querySelector('.cms-record-showcase__controls').hidden, false);
    fixture.resize(600);
    assert.equal(range.disabled, false);
    assert.equal(next.disabled, false);
    assertCompletePage(fixture);
    assert.equal(mount(0).root.querySelector('.cms-record-showcase__controls').hidden, true);
});

test('RTL reverses physical scrubber position and horizontal keyboard direction', (t) => {
    const { window, mount } = setup(t);
    const fixture = mount();
    const { swiper, root, range } = fixture;
    swiper.changeLanguageDirection('rtl');
    range.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true }));
    assert.equal(swiper.activeIndex, 3);
    assert.equal(
        Number(
            root.querySelector('.cms-record-showcase__progress').style.getPropertyValue('--_showcase-progress-position')
        ),
        1 - swiper.snapIndex / (swiper.snapGrid.length - 1)
    );
    assertCompletePage(fixture);
});

test('reduced motion updates live and reinitialization retires previous listeners', (t) => {
    const { window, media, mount } = setup(t);
    const first = mount();
    assert.equal(first.swiper.params.speed, 560);
    media.matches = true;
    media.dispatchEvent(new window.Event('change'));
    assert.equal(first.swiper.params.speed, 0);
    const second = mount(7, first.root);
    assert.equal(first.swiper.destroyed, true);
    assert.equal(second.swiper.params.speed, 0);
    second.next.click();
    assert.equal(second.swiper.activeIndex, 3);
    assertCompletePage(second);
    second.swiper.destroy();
    media.matches = false;
    assert.doesNotThrow(() => media.dispatchEvent(new window.Event('change')));
    assert.doesNotThrow(() => second.range.dispatchEvent(new window.Event('input')));
});

test('removing a CMS fragment releases its Swiper instance', async (t) => {
    const { mount } = setup(t);
    const { root, swiper } = mount();
    root.remove();
    await Promise.resolve();
    assert.equal(swiper.destroyed, true);
});
