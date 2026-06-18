const defaults = {
  baseUrl: 'https://api.example.com',
  subscriptionTemplateId: '',
  timeout: 20000
};

let localConfig = {};
try {
  localConfig = require('./local');
} catch (error) {
  localConfig = {};
}

const config = {
  ...defaults,
  ...localConfig
};

module.exports = config;
