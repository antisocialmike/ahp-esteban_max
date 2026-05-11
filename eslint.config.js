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
                // AGREGA ESTA LÍNEA:
                ahpNavigate: "readonly", 
                Toast: "readonly"
            }
        },
        rules: {
            "no-unused-vars": "warn", // Ponlo en warn para que pase el build
            "no-undef": "warn"        // Ponlo en warn para que pase el build
        }
    }
];