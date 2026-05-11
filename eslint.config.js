module.exports = [
    {
        languageOptions: {
            sourceType: "commonjs",
            globals: {
                // Esto es para que no te salgan errores de "require" o "process"
                process: "readonly",
                require: "readonly",
                module: "readonly",
                __dirname: "readonly",
                console: "readonly"
            }
        },
        rules: {
            "no-unused-vars": "error", // Aquí es donde le decimos que sea FATAL
            "no-undef": "error"
        }
    }
];