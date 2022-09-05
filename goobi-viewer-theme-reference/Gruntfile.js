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
			templatesFolder: 'WebContent/resources/themes/<%=theme.name%>/',
        	jsDevFolder: 'WebContent/resources/themes/<%=theme.name%>/javascript/dev/',
            jsDistFolder: 'WebContent/resources/themes/<%=theme.name%>/javascript/dist/',
            lessDevCsFolder: 'WebContent/resources/themes/<%=theme.name%>/css/less/crowdsourcing/',
            lessDevViewerFolder: 'WebContent/resources/themes/<%=theme.name%>/css/less/',
            lessSubThemeOneFolder: 'WebContent/resources/themes/<%=theme.name%>/css/less/subthemes/<%=theme.subThemeOne%>/',
            lessSubThemeTwoFolder: 'WebContent/resources/themes/<%=theme.name%>/css/less/subthemes/<%=theme.subThemeTwo%>/',
            cssDistFolder: 'WebContent/resources/themes/<%=theme.name%>/css/dist/'
        },
        sync: {
        	main: {
        		files: [{
        			cwd: 'WebContent',
        			src: [
        				'**'
        			],
        			dest: getTomcatDir() + '/goobi-viewer-theme-<%=theme.name%>'
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
					sourceMapURL: "<%=theme.name%>.min.css.map",
					sourceMapRootpath: "../",
					sourceMapBasepath: "WebContent/resources/themes/<%=theme.name%>/css/",
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
		concat : {
			options : {
				separator : ';',
			},
			dist : {
				src : [ '<%=src.jsDevFolder %>custom.js' ],
				dest : '<%=src.jsDistFolder %>custom.min.js',
			},
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
                tasks: [ 'concat', 'sync' ],
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
            },
			riot: {
				files: [
					'<%=src.jsDevFolder %>/*.tag'
				],
				tasks: ['riot', 'sync'],
				options: {
					spawn: false,
				}
			}
        },
		riot: {
            options:{
                concat: true
            },
            dist: {
                expand: false,
                src: '<%=src.jsDevFolder %>/*.tag',
                dest: '<%=src.jsDistFolder%><%=theme.name%>-tags.js'
            }
        },
		replace: {
        	dist: {
            	options:{
	          		patterns: [ {
						match: /cachetimestamp=[0-9-]+/g,
						replacement: 'cachetimestamp=<%= new Date().getFullYear()+"-"+(new Date().getMonth()+1)+"-"+new Date().getDate()+"-"+(new Date().getHours())+"-"+(new Date().getMinutes())+"-"+(new Date().getSeconds()) %>' 
					} ],
					usePrefix: false,
            	},
			  files: [
			    {
			     expand: true, flatten: true, src: ['<%=src.templatesFolder%>*.html'], dest: '<%=src.templatesFolder%>'
			    },
			    {
			     expand: false, flatten: true, src: ['WebContent/resources/themes/<%=theme.name%>/includes/customJS.xhtml'], dest: 'WebContent/resources/themes/<%=theme.name%>/includes/customJS.xhtml'
			    }
			  ]

            }
        },
    });
    
	// ---------- LOAD TASKS ----------
    grunt.loadNpmTasks('grunt-contrib-less');
    grunt.loadNpmTasks('grunt-contrib-watch' );
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-riot');
    grunt.loadNpmTasks('grunt-sync');
	grunt.loadNpmTasks('grunt-replace');
    
	// ---------- REGISTER DEVELOPMENT TASKS ----------
    grunt.registerTask('default', [ 'sync', 'watch' ]);
    grunt.registerTask('cache', [ 'sync', 'replace' ]);

};
