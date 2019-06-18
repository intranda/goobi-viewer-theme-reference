module.exports = function(grunt) {
	// ---------- PROJECT CONFIG ----------
    grunt.initConfig({
        theme: {
            name: 'reference',
            subThemeOne: 'reference-subtheme'
        },
        pkg: grunt.file.readJSON('package.json'),
        src: {
        	jsDevFolder: 'WebContent/resources/themes/<%=theme.name%>/javascript/dev/',
            jsDistFolder: 'WebContent/resources/themes/<%=theme.name%>/javascript/dist/',
            lessDevCsFolder: 'WebContent/resources/themes/<%=theme.name%>/css/less/cs/',
            lessDevViewerFolder: 'WebContent/resources/themes/<%=theme.name%>/css/less/viewer/',
            lessDevSubThemeOneFolder: 'WebContent/resources/themes/<%=theme.name%>/css/less/subthemes/<%=theme.subThemeOne%>/',
            cssDevFolder: 'WebContent/resources/themes/<%=theme.name%>/css/dev/',
            cssDistFolder: 'WebContent/resources/themes/<%=theme.name%>/css/dist/'
        },
        less: {
            development: {
                options: {
                    paths: [ '<%=src.lessDevViewerFolder%>', '<%=src.lessDevCsFolder%>' ],
                    plugins: [
                        new ( require( 'less-plugin-autoprefix' ) ) ( { browsers: ["last 2 versions"], grid: true } )
                    ],
                    compress: false,
                    optimization: 9
                },
                files: {
                    '<%=src.cssDevFolder %><%=theme.name%>.css': '<%=src.lessDevViewerFolder%>constructor.less',
                    '<%=src.cssDevFolder %><%=theme.name%>-cs.css': '<%=src.lessDevCsFolder%>csConstructor.less',
                    '<%=src.cssDevFolder %><%=theme.subThemeOne%>.css': '<%=src.lessDevSubThemeOneFolder%>subThemeConstructor.less',
                }
            },
            production: {
                options: {
                    paths: [ '<%=src.lessDevViewerFolder%>', '<%=src.lessDevCsFolder%>'  ],
                    plugins: [
                        new ( require( 'less-plugin-autoprefix' ) ) ( { browsers: ["last 2 versions"], grid: true } )
                    ],
                    compress: true,
                    sourceMap: true,
                    outputSourceFiles: true,
                    banner: '/*!\n ============================================================\n <%= pkg.name %> \n\n Version: <%= pkg.version %> \n License: <%= pkg.license %> \n Author: <%= pkg.author %> \n Description: <%= pkg.description %> \n ============================================================ \n*/',
                },
                files: {
                    '<%=src.cssDistFolder %><%=theme.name%>.min.css': '<%=src.lessDevViewerFolder%>constructor.less',
                    '<%=src.cssDistFolder %><%=theme.name%>-cs.min.css': '<%=src.lessDevCsFolder%>csConstructor.less',
                    '<%=src.cssDistFolder %><%=theme.subThemeOne%>.min.css': '<%=src.lessDevSubThemeOneFolder%>subThemeConstructor.less',
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
                tasks: [ 'less' ],
                options: {
                    spawn: false,
                }
            },
            scripts: {
                files: [ '<%=src.jsDevFolder %>*.js' ],
                tasks: [ 'uglify' ],
                options: {
                	spawn: false,
                }
            },
            riot: {
				files : [
					'<%=src.jsDevFolder %>tags/**/*.tag'
				],
				tasks : [ 'riot' ],
				options : {
					spawn : false,
				}
			}
		},
		riot: {
            options:{
                concat: true
            },
            dist: {
                expand: false,
                src: '<%=src.jsDevFolder %>tags/**/*.tag',
                dest: '<%=src.jsDistFolder%><%=theme.name%>-tags.js'
            }
        },
    });
    
	// ---------- LOAD TASKS ----------
    grunt.loadNpmTasks('grunt-contrib-less');
    grunt.loadNpmTasks( 'grunt-contrib-watch' );
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-riot');
    
	// ---------- REGISTER DEVELOPMENT TASKS ----------
    grunt.registerTask( 'default', [ 'watch' ] );
};