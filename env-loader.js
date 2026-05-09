class EnvLoader {
    constructor() {
        this.config = {};
        this.loadConfig();
    }
    
    // Chargement de la configuration depuis config.env
    async loadConfig() {
        try {
            const response = await fetch('./config.env');
            const text = await response.text();
            this.parseEnvFile(text);
        } catch (error) {
            console.warn('Fichier config.env non trouvé, utilisation des valeurs par défaut');
            this.setDefaultConfig();
        }
    }
    
    // Parsing du fichier .env
    parseEnvFile(text) {
        const lines = text.split('\n');
        
        lines.forEach(line => {
            line = line.trim();
            
            // Ignorer les commentaires et lignes vides
            if (line.startsWith('#') || line === '') {
                return;
            }
            
            // Parser les variables KEY=VALUE
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length > 0) {
                let value = valueParts.join('=').trim();
                
                // Supprimer les guillemets si présents
                if ((value.startsWith('"') && value.endsWith('"')) || 
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                
                // Conversion des types
                if (value === 'true') {
                    this.config[key] = true;
                } else if (value === 'false') {
                    this.config[key] = false;
                } else if (!isNaN(value) && value !== '') {
                    this.config[key] = Number(value);
                } else {
                    this.config[key] = value;
                }
            }
        });
    }
    
    // Configuration par défaut si le fichier .env n'est pas trouvé
    setDefaultConfig() {
        this.config = {
            LICENSE_KEY: "CC-2025-DEFAULT-KEY-FOR-DEV",
            AUTHORIZED_DOMAINS: "localhost,127.0.0.1",
            APP_VERSION: "1.0.0",
            APP_AUTHOR: "Lumen",
            PROTECTION_ENABLED: true,
            DEBUG_MODE: true
        };
    }
    
    // Récupération d'une valeur de configuration
    get(key, defaultValue = null) {
        return this.config[key] !== undefined ? this.config[key] : defaultValue;
    }
    
    // Récupération de tous les domaines autorisés
    getAuthorizedDomains() {
        const domains = this.get('AUTHORIZED_DOMAINS', 'localhost,127.0.0.1');
        return domains.split(',').map(domain => domain.trim());
    }
    
    // Vérification si la protection est activée
    isProtectionEnabled() {
        return this.get('PROTECTION_ENABLED', true);
    }
    
    // Vérification du mode debug
    isDebugMode() {
        return this.get('DEBUG_MODE', false);
    }
}

// Instance globale
window.EnvLoader = EnvLoader;
