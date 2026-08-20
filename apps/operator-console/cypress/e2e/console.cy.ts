describe('operator console smoke flow', () => {
  it('renders operational data and controls the live feed', () => {
    cy.visit('/');
    cy.contains('h2', 'Fleet health').should('be.visible');
    cy.contains(/independent portfolio demo/i).should('be.visible');
    cy.get('button[aria-label="Pause live feed"]').click();
    cy.get('button[aria-label="Resume live feed"]').should('be.visible');
  });

  it('surfaces deterministic assignment rollback', () => {
    cy.visit('/');
    cy.get('button[aria-label="Assign Payment terminal degraded"]').click();
    cy.contains(/assignment could not be saved/i).should('be.visible');
  });
});
