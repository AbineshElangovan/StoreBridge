import fs from 'fs';
import path from 'path';

export interface EmailTemplateConfig {
  subject: string;
  bannerText: string;
  bannerColor: string;
  headline: string;
  bodyMessage: string;
  buttonText: string;
  buttonColor: string;
}

export interface EmailTemplatesState {
  notify_me: EmailTemplateConfig;
  preorder: EmailTemplateConfig;
}

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplatesState = {
  notify_me: {
    subject: 'Good news! {{product_title}} is back in stock',
    bannerText: 'Back in Stock • Available Now',
    bannerColor: '#059669', // Emerald Green
    headline: 'Cotton T-shirt is Back in Stock!',
    bodyMessage: 'The item you requested at {{store_name}} is available now.',
    buttonText: 'Shop Now',
    buttonColor: '#111827', // Dark Slate
  },
  preorder: {
    subject: 'Pre-order Ready: {{product_title}} - {{store_name}}',
    bannerText: 'Pre-order Allocated • Ready for Fulfillment',
    bannerColor: '#7c3aed', // Purple
    headline: 'Your Pre-ordered Item is Ready',
    bodyMessage: 'Stock has arrived at {{store_name}}. Preparing fulfillment.',
    buttonText: 'View Order Status',
    buttonColor: '#111827', // Dark Slate
  },
};

const DATA_DIR = path.join(process.cwd(), '.storebridge_data');
const DATA_FILE = path.join(DATA_DIR, 'email-templates.json');

function ensureDataFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify({ default: DEFAULT_EMAIL_TEMPLATES }, null, 2), 'utf8');
    }
  } catch (e) {
    console.warn('[EmailTemplateStore] Could not create data file:', e);
  }
}

export class EmailTemplateStore {
  static getTemplates(storeId?: string): EmailTemplatesState {
    ensureDataFile();
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const data = JSON.parse(raw);
        const storeConfig = (storeId && data[storeId]) ? data[storeId] : data['default'];
        if (storeConfig) {
          return {
            notify_me: { ...DEFAULT_EMAIL_TEMPLATES.notify_me, ...(storeConfig.notify_me || {}) },
            preorder: { ...DEFAULT_EMAIL_TEMPLATES.preorder, ...(storeConfig.preorder || {}) },
          };
        }
      }
    } catch (e) {
      console.warn('[EmailTemplateStore] Error reading templates:', e);
    }
    return DEFAULT_EMAIL_TEMPLATES;
  }

  static saveTemplates(templates: EmailTemplatesState, storeId?: string): boolean {
    ensureDataFile();
    try {
      let data: Record<string, any> = {};
      if (fs.existsSync(DATA_FILE)) {
        try {
          data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        } catch {
          data = {};
        }
      }
      const key = storeId || 'default';
      data[key] = templates;
      data['default'] = templates; // keep global default updated as well
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error('[EmailTemplateStore] Error saving templates:', e);
      return false;
    }
  }
}
