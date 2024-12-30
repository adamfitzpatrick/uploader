const { defineConfig } = require("@yarnpkg/types");

module.exports = defineConfig({
  async constraints({ Yarn }) {
    for (const dep of Yarn.dependencies({ ident: 'cdk' })) {
      dep.update('2.173.2');
    }
    for (const dep of Yarn.dependencies({ ident: 'constructs' })) {
      dep.update('10.3.0');
    }
    for (const dep of Yarn.dependencies({ ident: 'aws-cdk-lib' })) {
      dep.update('2.173.2');
    }
    for (const dep of Yarn.dependencies({ ident: 'typescript' })) {
      dep.update('5.5.4');
    }
  },
});
