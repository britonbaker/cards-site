# Card System Expansion - Planning

## Vision
Transform britonbaker.com from 3 static cards into a dynamic card system with multiple experience types, admin management, and curated daily rotations.

---

## Card Types

| Type | Icon | Active Animation | Examples |
|------|------|------------------|----------|
| 🎵 Music | Musical note | Visualizer bars (current) | Cube Runner, Ring World |
| 🎮 Game | Controller/joystick | Pixel particles? Score counter? | Interactive games |
| 🎬 Video | Play button | Progress bar? Film grain? | Video experiences |

### Type-Specific Animations (When Card is Active)

**Music Cards** (current)
- Visualizer bars in top-right ✅

**Game Cards**
- Ideas:
  - Pixel/particle effect
  - Score/lives counter
  - Controller icon pulse
  - Achievement pop-ups

**Video Cards**
- Ideas:
  - Progress bar
  - Playhead indicator
  - Film grain overlay
  - Timestamp display

---

## Frontend (User-Facing)

### Display
- Users see **3 cards** at a time (curated selection)
- Cards have small **type icon** in corner
- Same insert/expand interaction as current

### Rotation Options
1. **Daily refresh** - New 3 cards every day
2. **Random on visit** - 3 random from pool each page load
3. **Featured + random** - 1 featured + 2 random
4. **User preferences** - Remember what they've seen, show new ones

---

## Backend (Admin)

### Dashboard Features
- **Grid view** of all cards
- **Stats per card:**
  - Times inserted/opened
  - Average session duration
  - Last 7 days trend
  - Total unique visitors
- **Card management:**
  - Create new cards
  - Edit existing
  - Enable/disable
  - Set as featured
  - Reorder priority

### Card Schema
```json
{
  "id": "cube-runner",
  "title": "Cube Runner",
  "type": "music",  // music | game | video
  "thumbnail": "...",
  "color": "green",  // card color theme
  "enabled": true,
  "featured": false,
  "priority": 1,
  "stats": {
    "opens": 1234,
    "avgDurationSec": 45,
    "uniqueVisitors": 890
  },
  "createdAt": "2026-01-27",
  "content": {
    // type-specific content config
  }
}
```

---

## Technical Considerations

### Data Storage Options
1. **JSON file** - Simple, GitHub-hosted (current static approach)
2. **Supabase** - Free tier, real-time, easy dashboard
3. **Railway PostgreSQL** - Already have Railway
4. **Firebase** - Real-time, good free tier

### Stats Tracking
- Could use GoatCounter (already set up) for basic page views
- Custom endpoint for card-specific events (open, duration, close)

### Admin UI Options
1. **Simple markdown/JSON** - Edit files directly
2. **Custom dashboard** - Build React/Vue admin panel
3. **Notion as CMS** - Use Notion API, edit in Notion
4. **Headless CMS** - Sanity, Contentful, etc.

---

## MVP vs Full Vision

### MVP (Phase 1)
- [ ] Add card type icons
- [ ] Add type field to card data
- [ ] Different animations per type (even if simple)
- [ ] Basic JSON config for cards

### Phase 2
- [ ] More than 3 cards in pool
- [ ] Random/daily selection logic
- [ ] Basic stats tracking

### Phase 3
- [ ] Admin dashboard
- [ ] Full stats visualization
- [ ] Card creation UI

---

## Open Questions

1. How often should cards rotate? Daily? Weekly? Per-visit?
2. Should users be able to "favorite" or revisit specific cards?
3. Should there be a "see all cards" option, or keep it curated?
4. What makes a card "featured"?
5. Mobile-specific considerations for new types?

---

## Notes

*Add ideas here as we brainstorm*

