import { Page, Locator } from '@playwright/test';

export class CheckoutPage {
  readonly page: Page;
  readonly continueButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.continueButton = page.getByRole('button', { name: /save|confirm|continue|next/i }).first();
  }

  async goto() {
    await this.page.goto('/checkout');
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Gets the input field immediately following a label with the given text.
   * AddressCard labels have no htmlFor, so we use sibling XPath.
   */
  getInputAfterLabel(labelText: string | RegExp): Locator {
    return this.page
      .locator('label')
      .filter({ hasText: labelText })
      .first()
      .locator('xpath=following-sibling::input[1]');
  }

  get firstNameInput(): Locator {
    return this.getInputAfterLabel(/first name/i);
  }

  get lastNameInput(): Locator {
    return this.getInputAfterLabel(/last name/i);
  }

  get streetInput(): Locator {
    return this.getInputAfterLabel(/street/i);
  }

  get cityInput(): Locator {
    return this.getInputAfterLabel(/city/i);
  }

  get postalInput(): Locator {
    return this.getInputAfterLabel(/postal|zip/i);
  }

  async waitForStep1() {
    await this.page
      .locator('label')
      .filter({ hasText: /first name/i })
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 });
  }

  async fillInvoiceAddress(data: {
    firstName: string;
    lastName: string;
    street: string;
    number: string;
    postal: string;
    city: string;
  }) {
    await this.firstNameInput.fill(data.firstName);
    await this.lastNameInput.fill(data.lastName);
    await this.streetInput.fill(data.street);
    const numberInput = this.getInputAfterLabel(/number|house/i);
    await numberInput.fill(data.number).catch(() => {});
    await this.postalInput.fill(data.postal);
    await this.cityInput.fill(data.city);
  }
}
