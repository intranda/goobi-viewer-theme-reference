module.exports = function(grunt) {
	// ---------- LOAD TASKS ----------
    grunt.loadNpmTasks('grunt-contrib-less');
    grunt.loadNpmTasks( 'grunt-contrib-watch' );
    grunt.loadNpmTasks('grunt-contrib-uglify');
    
	// ---------- VARIABLES ----------
	var packageJson = grunt.file.readJSON('package.json');
	var sources = {
        jsDevFolder: 'src/META-INF/resources/resources/themes/<%=theme.name%>/javascript/dev/',
        jsDistFolder: 'src/META-INF/resources/resources/themes/<%=theme.name%>/javascript/dist/',
        lessDevCsFolder: 'src/META-INF/resources/resources/themes/<%=theme.name%>/css/less/cs/',
        lessDevViewerFolder: 'src/META-INF/resources/resources/themes/<%=theme.name%>/css/less/viewer/',
        cssDevFolder: 'src/META-INF/resources/resources/themes/<%=theme.name%>/css/dev/',
        cssDistFolder: 'src/META-INF/resources/resources/themes/<%=theme.name%>/css/dist/'
    };
	
	// ---------- PROJECT CONFIG ----------
    grunt.initConfig({
        theme: {
            name: 'reference'
        },
        pkg: packageJson,
        src: sources,
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
                files: [ 'src/META-INF/resources/resources/themes/<%=theme.name%>/css/**/*.less' ],
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
            }
        }
    });
    
	// ---------- REGISTER DEVELOPMENT TASKS ----------
    grunt.registerTask( 'default', [ 'watch' ] );
};