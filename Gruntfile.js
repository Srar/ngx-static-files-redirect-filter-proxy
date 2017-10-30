module.exports = function (grunt) {
    "use strict";

    grunt.initConfig({

        ts: {
            app: {
                files: [{
                    src: ["src/**/*.ts"],
                    dest: "./build/"
                }],
                options: {
                    baseUrl: "./src/",
                    module: "commonjs",
                    moduleResolution: "node",
                    target: "es6",
                    noImplicitAny: false,
                    sourceMap: false,
                    experimentalDecorators: true
                }
            }
        },

        clean: ["./build/"],

        watch: {
            typescript: {
                files: ["src/**/*.ts", "typings/**/*.d.ts"],
                tasks: ["ts"]
            },
        }
    });

    grunt.loadNpmTasks("grunt-ts");
    grunt.loadNpmTasks("grunt-contrib-watch");
    grunt.loadNpmTasks('grunt-contrib-clean');

    grunt.registerTask("build", ["clean", "ts"]);
};
