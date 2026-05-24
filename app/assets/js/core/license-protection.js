(function() {
    'use strict';

    function isDesktopApp() {
        return typeof window !== 'undefined' &&
            window.lumenDesktop &&
            window.lumenDesktop.isDesktop === true;
    }
    
    // Configuration de la licence (sera chargée depuis .env)
    let LICENSE_CONFIG = {
        key: "CC-2025-DEFAULT-KEY-FOR-DEV",
        domains: ["localhost", "127.0.0.1"],
        version: "1.0.0",
        author: "Lumen",
        protection: true
    };
    
    // Chargement de la configuration depuis .env
    async function loadLicenseConfig() {
        try {
            const envLoader = new EnvLoader();
            await envLoader.loadConfig();
            
            LICENSE_CONFIG = {
                key: envLoader.get('LICENSE_KEY', 'CC-2025-DEFAULT-KEY-FOR-DEV'),
                domains: envLoader.getAuthorizedDomains(),
                version: envLoader.get('APP_VERSION', '1.0.0'),
                author: envLoader.get('APP_AUTHOR', 'Lumen'),
                protection: envLoader.isProtectionEnabled()
            };
            
            if (envLoader.isDebugMode()) {
                console.log('Configuration de licence chargée:', LICENSE_CONFIG);
            }
        } catch (error) {
            console.warn('Erreur lors du chargement de la configuration:', error);
        }
    }
    
    // Fonction de vérification de licence
    function validateLicense() {
        if (isDesktopApp()) {
            return true;
        }
        const currentDomain = window.location.hostname;
        const currentProtocol = window.location.protocol;
        
        // Vérification du domaine autorisé
        if (!LICENSE_CONFIG.domains.includes(currentDomain)) {
            // Protection silencieuse - pas de message d'erreur
            return false;
        }
        
        // Vérification du protocole (HTTPS recommandé en production)
        if (currentProtocol !== 'https:' && currentDomain !== 'localhost' && currentDomain !== '127.0.0.1') {
            // Protection silencieuse - pas de message d'erreur
            return false;
        }
        
        return true;
    }
    
    // Protection anti-débogage
    function setupDebugProtection() {
        // Détection des outils de développement
        setInterval(function() {
            const devtools = {
                open: false,
                orientation: null
            };
            
            const threshold = 160;
            
            setInterval(function() {
                if (window.outerHeight - window.innerHeight > threshold || 
                    window.outerWidth - window.innerWidth > threshold) {
                    if (!devtools.open) {
                        devtools.open = true;
                        // Protection silencieuse - pas de message d'erreur
                    }
                } else {
                    devtools.open = false;
                }
            }, 500);
        }, 1000);
        
        // Détection de la console
        let devtools = {open: false, orientation: null};
        const threshold = 160;
        
        setInterval(function() {
            if (window.outerHeight - window.innerHeight > threshold || 
                window.outerWidth - window.innerWidth > threshold) {
                if (!devtools.open) {
                    devtools.open = true;
                    // Protection silencieuse - pas de message d'erreur
                }
            } else {
                devtools.open = false;
            }
        }, 500);
    }
    
    // Protection anti-copie
    function setupCopyProtection() {
        // Désactiver le clic droit (silencieux)
        document.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            return false;
        });
        
        // Désactiver les raccourcis clavier
        document.addEventListener('keydown', function(e) {
            // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
            if (e.keyCode === 123 || 
                (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74)) ||
                (e.ctrlKey && e.keyCode === 85)) {
                e.preventDefault();
                return false;
            }
        });
        
        // Désactiver la sélection de texte
        document.addEventListener('selectstart', function(e) {
            e.preventDefault();
            return false;
        });
        
        // Désactiver le glisser-déposer
        document.addEventListener('dragstart', function(e) {
            e.preventDefault();
            return false;
        });
    }
    
    
    // Watermarking invisible
    function addWatermark() {
        const watermark = document.createElement('div');
        watermark.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            color: rgba(255,255,255,0.1);
            font-size: 10px;
            font-family: Arial, sans-serif;
            pointer-events: none;
            user-select: none;
            z-index: 1000;
        `;
        watermark.textContent = `LM-${LICENSE_CONFIG.version}-${Date.now()}`;
        document.body.appendChild(watermark);
    }
    
    // Initialisation de la protection
    async function initProtection() {
        // Charger la configuration depuis .env
        await loadLicenseConfig();

        if (isDesktopApp()) {
            return;
        }
        
        // Vérifier si la protection est activée
        if (!LICENSE_CONFIG.protection) {
            console.log('Protection désactivée via configuration');
            return;
        }
        
        // Vérifier la licence
        if (!validateLicense()) {
            return;
        }
        
        // Activer les protections
        setupDebugProtection();
        setupCopyProtection();
        addWatermark();
        
        // Log de démarrage (visible uniquement si autorisé)
        console.log(`Lumen v${LICENSE_CONFIG.version} - Protection activée`);
    }
    
    // Démarrer la protection
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initProtection);
    } else {
        initProtection();
    }
    
    // Exposer la configuration (pour debug autorisé uniquement)
    window.LumenLicense = LICENSE_CONFIG;
    
})();
