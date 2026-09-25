import {
    test,
    expect,
  } from "@playwright/test";
  
  test(
    "a user can search Hulk and manage a private note",
    async ({ page }) => {
      const username =
        `e2e_${Date.now()}`;
  
      const password =
        "A long test-only password!";
  
      /*
       * ------------------------
       * OPEN THE APPLICATION
       * ------------------------
       */
  
      await page.goto(
        "/"
      );
  
      await expect(
        page.getByRole(
          "heading",
          {
            name:
              "Marvel Character Explorer",
          }
        )
      ).toBeVisible();
  
      /*
       * ------------------------
       * SEARCH FOR HULK
       * ------------------------
       */
  
      await page
        .getByRole(
          "searchbox",
          {
            name:
              "Search by character name",
          }
        )
        .fill(
          "Hulk"
        );
  
      await page
        .getByRole(
          "button",
          {
            name:
              "Search",
            exact:
              true,
          }
        )
        .click();
  
      const hulkLink =
        page.getByRole(
          "link",
          {
            name:
              "Hulk",
            exact:
              true,
          }
        );
  
      await expect(
        hulkLink
      ).toBeVisible();
  
      /*
       * ------------------------
       * OPEN HULK
       * ------------------------
       */
  
      await hulkLink.click();
  
      await expect(
        page.getByRole(
          "heading",
          {
            name:
              "Hulk",
            exact:
              true,
          }
        )
      ).toBeVisible();
  
      /*
       * ------------------------
       * CREATE AN ACCOUNT
       * ------------------------
       */
  
      await page
        .getByRole(
          "link",
          {
            name:
              "Sign in or create an account",
          }
        )
        .click();
  
      await page
        .getByRole(
          "button",
          {
            name:
              "New here? Create an account",
          }
        )
        .click();
  
      await page
        .getByLabel(
          "Username"
        )
        .fill(
          username
        );
  
      await page
        .getByLabel(
          "Password"
        )
        .fill(
          password
        );
  
      await page
        .getByRole(
          "button",
          {
            name:
              "Create account",
          }
        )
        .click();
  
      /*
       * Authentication should return
       * us to Hulk.
       */
      await expect(
        page.getByRole(
          "heading",
          {
            name:
              "Hulk",
            exact:
              true,
          }
        )
      ).toBeVisible();
  
      await expect(
        page.getByText(
          `Signed in as ${username}`
        )
      ).toBeVisible();
  
      await expect(
        page.getByRole(
          "heading",
          {
            name:
              "Notes about Hulk",
          }
        )
      ).toBeVisible();
  
      /*
       * ------------------------
       * CREATE NOTE
       * ------------------------
       */
  
      await page
        .getByLabel(
          "Add a note"
        )
        .fill(
          "My E2E Hulk note"
        );
  
      await page
        .getByRole(
          "button",
          {
            name:
              "Save note",
          }
        )
        .click();
  
      await expect(
        page.getByText(
          "Note saved."
        )
      ).toBeVisible();
  
      await expect(
        page.getByText(
          "My E2E Hulk note",
          {
            exact:
              true,
          }
        )
      ).toBeVisible();
  
      /*
       * ------------------------
       * REFRESH THE BROWSER
       * ------------------------
       *
       * This is important:
       *
       * React memory disappears,
       * but the session cookie and
       * MongoDB data should survive.
       */
  
      await page.reload();
  
      await expect(
        page.getByText(
          `Signed in as ${username}`
        )
      ).toBeVisible();
  
      await expect(
        page.getByText(
          "My E2E Hulk note",
          {
            exact:
              true,
          }
        )
      ).toBeVisible();
  
      /*
       * ------------------------
       * EDIT NOTE
       * ------------------------
       */
  
      await page
        .getByRole(
          "button",
          {
            name:
              "Edit",
            exact:
              true,
          }
        )
        .click();
  
      await page
        .getByLabel(
          "Edit note"
        )
        .fill(
          "My edited E2E Hulk note"
        );
  
      await page
        .getByRole(
          "button",
          {
            name:
              "Save changes",
          }
        )
        .click();
  
      await expect(
        page.getByText(
          "Note updated."
        )
      ).toBeVisible();
  
      await expect(
        page.getByText(
          "My edited E2E Hulk note",
          {
            exact:
              true,
          }
        )
      ).toBeVisible();
  
      /*
       * ------------------------
       * DELETE NOTE
       * ------------------------
       */
  
      await page
        .getByRole(
          "button",
          {
            name:
              "Delete",
            exact:
              true,
          }
        )
        .click();
  
      await page
        .getByRole(
          "button",
          {
            name:
              "Confirm delete",
          }
        )
        .click();
  
      await expect(
        page.getByText(
          "No notes yet. Add the first one."
        )
      ).toBeVisible();
  
      /*
       * ------------------------
       * SIGN OUT
       * ------------------------
       */
  
      await page
        .getByRole(
          "button",
          {
            name:
              "Sign out",
          }
        )
        .click();
  
      await expect(
        page.getByRole(
          "link",
          {
            name:
              "Sign in / Create account",
          }
        )
      ).toBeVisible();
  
      await expect(
        page.getByRole(
          "link",
          {
            name:
              "Sign in or create an account",
          }
        )
      ).toBeVisible();
    }
  );