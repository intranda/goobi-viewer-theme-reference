const fs = require("fs")
let homedir = require("os").homedir();
let rawdata = fs.readFileSync(homedir + '/.config/grunt_userconfig.json');
let config = JSON.parse(rawdata);

function getTomcatDir() {
	return config.tomcat_dir;
} 

module.exports = function(grunt) {
	// ---------- PROJECT CONFIG ----------
    grunt.initConfig({
        theme: {
            name: 'reference',
            subThemeOne: 'subtheme1',
            subThemeTwo: 'subtheme2' 
        },
        pkg: grunt.file.readJSON('package.json'),
        src: {
        	jsDevFolder: 'WebContent/resources/themes/<%=theme.name%>/javascript/dev/',
            jsDistFolder: 'WebContent/resources/themes/<%=theme.name%>/javascript/dist/',
            lessDevCsFolder: 'WebContent/resources/themes/<%=theme.name%>/css/less/cs/',
            lessDevViewerFolder: 'WebContent/resources/themes/<%=theme.name%>/css/less/',
            lessSubThemeOneFolder: 'WebContent/resources/themes/<%=theme.name%>/css/less/subthemes/<%=theme.subThemeOne%>/',
            lessSubThemeTwoFolder: 'WebContent/resources/themes/<%=theme.name%>/css/less/subthemes/<%=theme.subThemeTwo%>/',
            cssDevFolder: 'WebContent/resources/themes/<%=theme.name%>/css/dev/',
            cssDistFolder: 'WebContent/resources/themes/<%=theme.name%>/css/dist/'
        },
        sync: {
        	main: {
        		files: [{
        			cwd: 'WebContent',
        			src: [
        				'**'
        			],
        			dest: getTomcatDir() + '\\goobi-viewer-theme-reference'
        		}],
        		verbose: true
        	}
        },
        less: {
            development: {
                options: {
                    paths: [ '<%=src.lessDevViewerFolder%>', '<%=src.lessDevCsFolder%>' ],
                    plugins: [
                        new ( require( 'less-plugin-autoprefix' ) ) ( { browsers: ["last 2 versions"] } )
                    ],
                    compress: false,
                    optimization: 9
                },
                files: {
                    '<%=src.cssDevFolder %><%=theme.name%>.css': '<%=src.lessDevViewerFolder%>constructor.less',
                    '<%=src.cssDevFolder %><%=theme.name%>-cs.css': '<%=src.lessDevCsFolder%>csConstructor.less',
                }
            },
            production: {
                options: {
                    paths: [ '<%=src.lessDevViewerFolder%>', '<%=src.lessDevCsFolder%>'  ],
                    plugins: [
                        new ( require( 'less-plugin-autoprefix' ) ) ( { browsers: ["last 2 versions"] } )
                    ],
                    compress: true,
                    sourceMap: true,
                    banner: '/*!\n ============================================================\n <%= pkg.name %> \n\n Version: <%= pkg.version %> \n License: <%= pkg.license %> \n Author: <%= pkg.author %> \n Description: <%= pkg.description %> \n ============================================================ \n*/',
                },
                files: {
                    '<%=src.cssDistFolder %><%=theme.name%>.min.css': '<%=src.lessDevViewerFolder%>constructor.less',
                    '<%=src.cssDistFolder %><%=theme.name%>-cs.min.css': '<%=src.lessDevCsFolder%>csConstructor.less',
                	'<%=src.cssDistFolder %><%=theme.subThemeOne%>.min.css': '<%=src.lessSubThemeOneFolder%>subThemeConstructor.less',
                	'<%=src.cssDistFolder %><%=theme.subThemeTwo%>.min.css': '<%=src.lessSubThemeTwoFolder%>subThemeConstructor.less',
                }
            }
        },
        uglify: {
            my_target: {
                files: {
                    '<%=src.jsDistFolder %>custom.min.js': ['<%=src.jsDevFolder %>custom.js']
                }
            }
        },
        watch: {
        	configFiles : {
				files : [ 'Gruntfile.js' ],
				options : {
					reload : true
				}
			},
            css: {
                files: [ 'WebContent/resources/themes/<%=theme.name%>/css/**/*.less' ],
                tasks: [ 'less', 'sync' ],
                options: {
                    spawn: false,
                }
            },
            scripts: {
                files: [ '<%=src.jsDevFolder %>*.js' ],
                tasks: [ 'uglify', 'sync' ],
                options: {
                	spawn: false,
                }
            },
            html: {
            	files: [ 'WebContent/resources/themes/<%=theme.name%>/**/*html' ],
                tasks: [ 'sync' ],
                options: {
                	spawn: false,
                }
            }
        }
    });
    
	// ---------- LOAD TASKS ----------
    grunt.loadNpmTasks('grunt-contrib-less');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-sync');
    
	// ---------- REGISTER DEVELOPMENT TASKS ----------
    grunt.registerTask( 'default', [ 'watch', 'sync' ] );
};

