describe('operator console smoke flow', () => {
  it('renders operational data and controls the live feed', () => {
    cy.visit('/');
    cy.findByRole('heading', { name: /fleet health/i }).should('be.visible');
    cy.findByText(/independent portfolio demo/i).should('be.visible');
    cy.findByRole('button', { name: /pause live feed/i }).click();
    cy.findByRole('button', { name: /resume live feed/i }).should('be.visible');
  });
  it('surfaces deterministic assignment rollback', () => {
    cy.visit('/');
    cy.findByRole('button', { name: /assign payment terminal degraded/i }).click();
    cy.findByText(/assignment could not be saved/i).should('be.visible');
  });
});
