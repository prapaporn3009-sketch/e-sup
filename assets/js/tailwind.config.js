tailwind.config = {
    theme: {
        extend: {
            fontFamily: {
                sans: ['Sarabun', 'sans-serif'],
            },
            colors: {
                school: {
                    light: '#3b82f6', 
                    DEFAULT: '#1e40af', 
                    dark: '#1e3a8a',
                }
            },
            animation: {
                'fade-in': 'fadeIn 1s ease-out',
                'float': 'float 3s ease-in-out infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-10px)' },
                }
            }
        }
    }
}
