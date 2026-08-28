# Acne Guide Access

I have an existing Skin Science with Kii — Acne Starter Guide website/project.



I want you to MODIFY THE EXISTING PROJECT, NOT rebuild or redesign it.



Keep the existing:

- design

- colours

- fonts

- illustrations

- page layout

- acne content

- spacing

- animations

- branding

- Skin Science with Kii aesthetic



Only make the changes described below.



━━━━━━━━━━━━━━━━━━━━

PAYMENT SYSTEM

━━━━━━━━━━━━━━━━━━━━



The guide costs ₹399 as a ONE-TIME payment.



I have already created a Razorpay Standard Payment Link:



https://rzp.io/rzp/DnSVNzC



Razorpay Payment Link ID:

plink_TVG4aXI7umB4mf



The current website has a manual "I've paid" / unlock mechanism.



REMOVE THAT COMPLETELY.



There must NEVER be an "I've paid" button.



A user must not be able to unlock the guide simply by:

- clicking a button

- changing the URL

- refreshing the page

- using localStorage

- using sessionStorage

- changing a JavaScript variable

- adding ?paid=true or anything similar



I want REAL payment verification.



━━━━━━━━━━━━━━━━━━━━

CUSTOMER EXPERIENCE

━━━━━━━━━━━━━━━━━━━━



On the locked page, create a clean premium payment card matching the existing design.



Use this copy:



"Your full acne guide is waiting."



"Unlock the complete Skin Science with Kii Acne Starter Guide."



"₹399 • One-time payment"



Button:



"Unlock my guide — ₹399"



When the customer taps the button, open my Razorpay Payment Link.



After the customer pays, DO NOT automatically unlock the guide just because they returned from Razorpay.



The payment must be verified by the server first.



Only after successful verification should the paid guide become accessible.



If payment fails, is cancelled, or cannot be verified, keep the guide locked.



Do not show technical/payment-processing language to customers.



After successful verified payment, show:



"You're in. Let's understand your acne."



Then allow access to the paid guide.



━━━━━━━━━━━━━━━━━━━━

RAZORPAY VERIFICATION

━━━━━━━━━━━━━━━━━━━━



Implement secure server-side Razorpay payment verification.



Use Razorpay's Payment Link webhook:



payment_link.paid



Create a backend webhook endpoint, for example:



POST /api/razorpay/webhook



The webhook must:



1. Receive the RAW Razorpay request body.

2. Verify the Razorpay webhook signature using a server-side environment variable called:



RAZORPAY_WEBHOOK_SECRET



3. Only accept the relevant successful payment event.

4. Confirm that the Payment Link ID is:



plink_TVG4aXI7umB4mf



5. Confirm that the amount paid is ₹399 = 39900 paise.

6. Record the verified purchase securely.

7. Make the webhook idempotent so duplicate webhook events do not create duplicate purchases.

8. Never trust any "paid=true" value coming from the browser.



IMPORTANT:



Never put:

- RAZORPAY_WEBHOOK_SECRET

- Razorpay Key Secret

- any private API credential



inside frontend JavaScript, HTML, or publicly accessible files.



Use Lovable's secure environment/secrets mechanism.



━━━━━━━━━━━━━━━━━━━━

PAID CONTENT PROTECTION

━━━━━━━━━━━━━━━━━━━━



Do not simply put the entire paid guide in the public HTML and hide it with CSS.



If necessary, restructure the project so the paid content is returned by a protected backend endpoint only after the user's payment has been verified.



Use a secure server-side access mechanism/session after successful payment.



The frontend should ask the server whether the customer has verified access.



Only then should the paid content be loaded/displayed.



Do NOT create fake security.



If the current architecture makes this impossible, tell me exactly what needs to change rather than pretending that hiding HTML is secure.



━━━━━━━━━━━━━━━━━━━━

RAZORPAY REDIRECT

━━━━━━━━━━━━━━━━━━━━



If the Razorpay Payment Link supports a success/callback URL, configure it appropriately for this project.



However:



A Razorpay redirect/return URL is NOT proof of payment.



The server must still verify the actual payment through Razorpay's server-side mechanism/webhook before granting access.



━━━━━━━━━━━━━━━━━━━━

IMPORTANT DESIGN REQUIREMENTS

━━━━━━━━━━━━━━━━━━━━



Do not make the payment section large or text-heavy.



It should feel premium and simple.



Do not add:

- QR codes

- "I've paid" buttons

- unnecessary payment instructions

- unnecessary pages

- blank placeholders

- fake unlock buttons



Do not leave empty space after removing the old payment mechanism.



The only customer-facing payment action should be:



"Unlock my guide — ₹399"



━━━━━━━━━━━━━━━━━━━━

SUBSTACK

━━━━━━━━━━━━━━━━━━━━



At the end of the guide, keep my Substack link:



https://open.substack.com/pub/skinsciencewithkii



Do NOT add a QR code.



Do NOT leave a QR-code placeholder.



Do NOT leave an "[INSERT INSTAGRAM]" placeholder.



━━━━━━━━━━━━━━━━━━━━

FINAL CHECK

━━━━━━━━━━━━━━━━━━━━



Before finishing, inspect the entire project.



Make sure:



✓ The old "I've paid" mechanism is completely removed.

✓ Nobody can unlock the guide without a verified payment.

✓ No client-side fake payment verification exists.

✓ No Razorpay secret is exposed in frontend code.

✓ The ₹399 Razorpay Payment Link is used.

✓ The Payment Link ID is checked server-side.

✓ The amount ₹399 is checked server-side.

✓ Razorpay webhook signature is verified.

✓ The raw webhook body is used for signature verification.

✓ Duplicate webhooks are handled safely.

✓ Paid content is protected as much as technically possible.

✓ The existing guide design remains intact.

✓ The QR code is removed.

✓ No blank QR-code area remains.

✓ No Instagram placeholder remains.

✓ The Substack link remains.

✓ The payment experience looks clean and premium.



Do not make unnecessary changes to the guide.



After implementing everything, give me a very simple non-technical setup checklist telling me:



1. What files you changed.

2. What secrets/environment variables I need to add.

3. Where I add them in Lovable.

4. The exact webhook URL I need to enter in Razorpay.

5. Which Razorpay webhook event I need to select.

6. Whether I need to configure a callback/redirect URL.

7. How to test the payment flow.

8. How to test that an unpaid user cannot access the guide.



NEVER ask me to paste my Razorpay Secret Key or Webhook Secret into the chat.



If you need a secret, tell me where I should enter it securely inside Lovable instead.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://skin-science-kii-unlock.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c96dfeac-54fd-48af-85fd-841d10181baa).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
