## Proposed Refactoring Plan for Marketplace Alters

**Goal:** Resolve data mixing issues, improve stability, and create separate chat experiences for premade and published alters by introducing a modular structure.

**Analysis Summary:** The core issues stem from shared JavaScript logic (`marketplace-enhanced.js`) handling both premade (static) and published (dynamic) alters, leading to state conflicts, especially during tab switching and asynchronous operations. Redundant logic in `marketplace-tabs.js` and reliance on `localStorage` for data passing exacerbate the problem.

**Proposed New Structure:**

1.  **HTML (`Marketplace.html`):**
    *   Keep the existing HTML structure for tabs, filters, and the two content containers (`#premade-content`, `#published-content`).
    *   **Remove** the script tag for `marketplace-tabs.js` to eliminate redundant/conflicting logic.
    *   Include a single main script, e.g., `<script type="module" src="marketplace.js"></script>`.

2.  **Main Marketplace Logic (`marketplace.js` - New/Refactored):**
    *   Acts as the central controller for the marketplace page.
    *   Handles initialization, tab switching logic (updating UI, showing/hiding containers).
    *   Manages common filter UI elements (search, category links, sort dropdown) and triggers filtering in the relevant module.
    *   Imports and coordinates `premade-alters.js` and `published-alters.js`.
    *   Loads the appropriate module's data when a tab is activated (e.g., load published alters only when that tab is clicked).

3.  **Premade Alters Module (`premade-alters.js` - New):**
    *   **Responsibility:** Manages *only* premade alters.
    *   Contains the static `mockPremadeAlters` data array.
    *   Provides functions to:
        *   Filter and sort the `mockPremadeAlters` based on criteria passed from `marketplace.js`.
        *   Render the premade alter cards into the `#premade-content` container.
        *   Handle events specific to premade alter cards (e.g., favorite, share).
        *   Handle the "Chat Now" button click:
            *   Extract necessary data (ID, name, image, generated prompt/personality) for the selected premade alter.
            *   Store this data temporarily in `sessionStorage` (e.g., `sessionStorage.setItem('premadeAlterChatData', JSON.stringify(data))`).
            *   Redirect the user to `/premade-chat.html`.

4.  **Published Alters Module (`published-alters.js` - New):**
    *   **Responsibility:** Manages *only* published alters.
    *   Imports and uses functions from `marketplace-integration.js` to fetch data from Supabase.
    *   Provides functions to:
        *   Fetch published alters from the API (`/api/published-alters` or directly via Supabase client).
        *   Filter and sort the fetched published alters based on criteria passed from `marketplace.js`.
        *   Render the published alter cards into the `#published-content` container.
        *   Handle events specific to published alter cards (e.g., favorite, share, delete for owner).
        *   Handle the "Chat Now" button click:
            *   Extract necessary data (ID, name, avatar_url, prompt, personality, etc.) from the selected published alter.
            *   Store this data temporarily in `sessionStorage` (e.g., `sessionStorage.setItem('publishedAlterChatData', JSON.stringify(data))`).
            *   Redirect the user to `/published-chat.html`.

5.  **Supabase Integration (`marketplace-integration.js`):**
    *   No major changes needed. Continues to provide functions for interacting with the `published_alters` table.

6.  **Premade Alter Chat Page (`premade-chat.html` & `premade-chat.js` - New):**
    *   `premade-chat.html`: A new HTML file, likely a copy/adaptation of `chat.html`, providing the chat UI structure.
    *   `premade-chat.js`: New JavaScript file for this page.
        *   On load, retrieves the premade alter data from `sessionStorage.getItem('premadeAlterChatData')`.
        *   Initializes the chat interface (using `streaming-client-api.js` or similar) with the specific premade alter's details (name, image, prompt).
        *   Clears the `sessionStorage` item after use.

7.  **Published Alter Chat Page (`published-chat.html` & `published-chat.js` - New):**
    *   `published-chat.html`: A new HTML file, similar to `premade-chat.html`.
    *   `published-chat.js`: New JavaScript file for this page.
        *   On load, retrieves the published alter data from `sessionStorage.getItem('publishedAlterChatData')`.
        *   Initializes the chat interface with the specific published alter's details.
        *   Clears the `sessionStorage` item after use.

8.  **Data Passing:**
    *   Switch from `localStorage` to `sessionStorage` for passing selected alter data to the chat pages. This limits the data's scope to the browser session and avoids persistent conflicts.

**Benefits:**
*   **Clear Separation:** Isolates logic for premade and published alters, making code easier to understand, debug, and maintain.
*   **Reduced State Conflicts:** Each module manages its own state, minimizing the chance of data mixing.
*   **Dedicated Chat Experiences:** Provides distinct, correctly initialized chat interfaces for each alter type.
*   **Improved Stability:** Eliminates race conditions caused by shared state and conflicting scripts.
*   **Cleaner Data Transfer:** Uses `sessionStorage` for safer, temporary data passing between pages.

**Next Step:** Validate this proposed structure with the user before implementation.
