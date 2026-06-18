# Prizecaster

Prizecaster is a presenter-friendly raffle drawing app for hackathons, meetups, conferences, community nights, classrooms, workshops, and any event where prizes need to be assigned quickly, fairly, and visibly.

It gives organizers a clean setup screen for configuring prizes and participant counts, then switches into a live drawing view designed for a big screen. The current prize is front and center, the drawing animation builds a little suspense, and the winner board keeps the room oriented as prizes are assigned.

## Live Preview

This repo is ready for GitHub Pages.

The website is a static app, so GitHub Pages can publish it directly from the `main` branch root. After Pages is enabled, the live preview is available at:

```text
https://disbitski.github.io/Prizecaster/
```

For local preview:

```bash
python3 -m http.server 4173
```

Then open:

```text
http://127.0.0.1:4173/
```

## What Prizecaster Does

Prizecaster helps event organizers run raffles without the usual spreadsheet shuffle, awkward pauses, or mystery math.

- Configure an event name, participant count, and any number of prizes.
- Name each prize so the live drawing screen always shows what is currently up for grabs.
- Run a presenter-ready live drawing view with a large animated number display.
- Enter winner details after each draw, such as a name, team, seat, ticket holder, or note.
- Keep previous winners visible while showing what prizes are still queued.
- Export the final results as JSON.
- Switch between dark and light themes for different rooms, projectors, and event vibes.

The app works well for:

- Hackathon prize ceremonies
- Booth raffles
- Community meetups
- Conference giveaways
- Classroom rewards
- Internal team events
- Sponsor prize drawings

## Why It Is Helpful At Events

Raffles are simple until a room full of people is watching.

Prizecaster keeps the experience clear for both the organizer and the audience. The setup screen handles the quiet admin work before the ceremony starts. The live drawing screen keeps the important information big, readable, and focused: current prize, winner number, previous winners, and upcoming prizes.

It also reduces event friction. Organizers do not need to edit slides mid-ceremony, juggle random number websites, or keep separate notes for winners. The entire flow lives in one lightweight static website.

## Drawing Modes

Prizecaster has two drawing modes:

- **Demo**: Uses browser cryptography for rehearsals, low-stakes events, and quick local usage.
- **Verified draw**: Uses the included smart contract to request randomness from Chainlink VRF v2.5.

Demo mode is convenient and free. Verified draw mode is for events where the organizer wants a stronger fairness story and an on-chain randomness trail.

## Powered By Chainlink VRF

Chainlink VRF, or Verifiable Random Function, is a Chainlink service that provides randomness along with cryptographic proof that the result was generated fairly and was not manipulated after the request.

That matters for raffles because random drawings should be more than "trust me, this number came from somewhere." With VRF, the drawing can be backed by a verifiable on-chain request and fulfillment. Prizecaster's optional verified mode calls a deployed `PrizecasterVRF` consumer contract, waits for Chainlink VRF fulfillment, then displays the resulting winner number.

VRF is optional because it has operational requirements and a small cost. To use it, you need a funded Chainlink VRF subscription on a supported network, and each randomness request consumes subscription funds for the VRF service and transaction gas. For casual or rehearsal usage, demo mode is enough. For public, sponsored, or higher-trust drawings, verified mode is the more rigorous path.

Official Chainlink VRF v2.5 documentation:

```text
https://docs.chain.link/vrf/v2-5/subscription/get-a-random-number
```

## Optional Chainlink VRF Setup

The Solidity consumer contract is in:

```text
contracts/PrizecasterVRF.sol
```

Basic setup flow:

1. Create and fund a VRF v2.5 subscription at `https://vrf.chain.link`.
2. Deploy `PrizecasterVRF` with:
   - `coordinatorAddress` for your target network
   - your `subscriptionId`
   - the network's VRF gas lane `keyHash`
3. Add the deployed contract as an approved consumer on the subscription.
4. Paste the deployed contract address into Prizecaster's setup screen.
5. Choose LINK or native payment to match how the subscription is funded.
6. Run the drawing in **Verified draw** mode.

The included Solidity contract is example code and has not been audited. Review, test, and audit it before using it for production or high-value prize drawings.

## Project Structure

```text
.
├── index.html
├── styles.css
├── app.js
└── contracts/
    └── PrizecasterVRF.sol
```

## Deployment Notes

Prizecaster is intentionally static. There is no build step, framework, or server dependency for the website itself.

GitHub Pages serves these files directly from the `main` branch root:

- `index.html`
- `styles.css`
- `app.js`
- `contracts/PrizecasterVRF.sol`
- `README.md`

If you fork or rename the repo, enable Pages from **Settings -> Pages** and select **Deploy from a branch**, then choose `main` and `/root`.
