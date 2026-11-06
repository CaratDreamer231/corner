# corner

**Brand names. Back-corner prices.**

A bilingual (English / Spanish) concept storefront for brand-name overstock, open-box, and certified-refurbished smart security tech. Built as a polished static prototype with a full shopping flow: discovery, search, product detail, cart, account, and a demo checkout with multiple payment rails.

> **Demo only.** No real payments are processed. No card data is stored or transmitted. Account credentials and orders are stored in the browser via `localStorage`.

---

## Run it

### Option A — local server (recommended)

From PowerShell:

    cd "$env:USERPROFILE\Desktop\corner"
    python -m http.server 4173

Then open:

    http://127.0.0.1:4173

> You can also use `npx serve .`, VS Code Live Server, or any static file server.
> Opening `index.html` directly with `file://` mostly works, but browsers may restrict `localStorage` for local files. A server gives the intended experience.

### Pages

| Page | File |
| --- | --- |
| Home | `index.html` |
| Shop / all finds | `shop.html` |
| Demo checkout | `checkout.html` |
| Account, sign in, register | `account.html` |

---

## What is included

- **Editorial home page** — hero, live drop, featured finds, brand wall, story, category cards, process, price comparison, testimonials, newsletter, footer.
- **Animated scroll experience** — reveal-on-scroll, parallax hero image, brand marquees, rotating verification stamp, hover states, scroll progress bar.
- **Shop** — 14 products, 15 brands, category / brand / condition / price filters, sorting, active filter chips, empty state.
- **Product detail modal** — image gallery, condition notes, specs, rating, quantity, add to cart.
- **Cart drawer** — add, remove, quantity controls, savings, free-shipping progress, checkout link.
- **Registration + login** — dedicated account page, member dashboard, demo order history, saved finds empty state, sign out.
- **Demo checkout** — contact and shipping validation, delivery options, order summary, promo code, tax calculation, and payment options:
  - Credit / debit card
  - Apple Pay
  - PayPal
  - Shop Pay
  - Klarna
  - Afterpay
  - Affirm
  - Apple Gift Card
  - Corner Gift Card
  - Bank transfer (ACH)
- **Order confirmation** — order number, delivery estimate, payment label, item summary, demo disclaimer.
- **Bilingual UI** — complete English / Spanish dictionary (`assets/js/i18n.js`), persistent language toggle, translated product names, descriptions, specs, states, forms, and errors.
- **Responsive** — desktop, tablet, small mobile, and a full-screen mobile navigation.
- **Accessibility touches** — skip link, focus states, ARIA labels, keyboard `Esc` handling, reduced-motion support.

---

## Try the demo

1. Add any product to the bag using the `+` button.
2. Open the bag and click **Checkout**.
3. Fill in the contact / shipping form, choose delivery, then choose any payment method.
4. For the card option use any demo number such as `4242 4242 4242 4242`, any future expiry, and any 3-digit CVC.
5. For **Apple Gift Card** / **Corner Gift Card**, any non-empty code works.
6. Place the order to see the confirmation screen and an order saved to the demo account.

**Account:** create an account with any email and a password of 8+ characters, or sign in with any valid email and 8+ character password. Reset the demo by clearing site data / `localStorage`.

---

## Project structure

    corner/
    ├─ index.html
    ├─ shop.html
    ├─ checkout.html
    ├─ account.html
    ├─ README.md
    └─ assets/
       ├─ css/
       │  ├─ main.css
       │  └─ checkout.css
       ├─ js/
       │  ├─ data.js        # product + brand catalog
       │  ├─ i18n.js        # EN/ES copy
       │  ├─ app.js         # global UI, cart, search, auth, product modal
       │  ├─ shop.js        # filters + sorting
       │  ├─ checkout.js    # checkout flow + demo payment
       │  └─ account.js     # account / auth page
       ├─ fonts/            # locally hosted Instrument Serif, Manrope, Space Mono
       └─ img/
          ├─ brands/        # brand tiles
          ├─ products/      # product photography
          ├─ editorial/     # lifestyle / warehouse imagery
          ├─ favicon.svg
          └─ og-image.jpg

---

## Asset notes

This is a non-commercial design prototype. Brand names and logos are trademarks of their respective owners and are used here for demonstration only. Product imagery is sourced from public manufacturer / retailer product pages and is not an offer for sale. Editorial photography is from Unsplash.

- Editorial: Unsplash (`photo-1600585154340-be6161a56a0c`, `photo-1616486338812-3dadae4b4ace`, `photo-1553413077-190dd305871c`).
- Product imagery: Ring / Wellbots product assets, Amazon product media, eufy, TP-Link Tapo, Wyze, Reolink, AOSU, LaView, DEKCO, Hikvision, Dahua, Imou, EZVIZ, Blink, Arlo.
- Brand logo tiles are cropped from the supplied category reference screenshots.
- Fonts: Instrument Serif, Manrope, and Space Mono via Google Fonts (SIL Open Font License).

---

## Production notes

This prototype is intentionally backend-free. For a real launch you would add:

- Server-side auth and sessions (not `localStorage`)
- PCI-compliant payment processor (Stripe, Adyen, etc.)
- Real Apple Pay / Google Pay merchant validation
- Inventory, tax, shipping, and returns services
- Order database and email notifications
- Consent management, cookie policy, and analytics
- Real legal, accessibility, and privacy review

---

**corner** — made for the deal hunters.
