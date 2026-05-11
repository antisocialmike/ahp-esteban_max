module.exports = [
    {
        languageOptions: {
            sourceType: "commonjs",
            globals: {
                // Globales de Node.js
                process: "readonly",
                require: "readonly",
                module: "readonly",
                __dirname: "readonly",
                console: "readonly",
                // Globales del Navegador (Frontend)
                window: "readonly",
                document: "readonly",
                fetch: "readonly",
                setTimeout: "readonly",
                localStorage: "readonly",
                FormData: "readonly",
                Blob: "readonly",
                Toast: "readonly" // Tu global personalizada
            }
        },
        rules: {
            "no-unused-vars": "error",
            "no-undef": "error"
        }
    }
];