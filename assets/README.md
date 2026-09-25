# Visual assets

- `typing-still-life.jpg`: homepage still life, 1536 × 1024, approximately 230 KB. Generated with the built-in `image_gen` tool, then converted to JPEG with `sips` for the static site.
- `favicon.svg`: local, code-drawn keyboard brand mark. UI icons are in `js/icons.js`.
- The game illustrations are CSS, so they remain sharp at every text size without additional downloads.

## Final image prompt

> Use case: stylized-concept. Asset type: homepage hero artwork for a beautifully designed Korean typing practice website. Create a premium minimal 3D editorial still life, wide landscape composition (3:2). A lovely tactile retro-modern cream mechanical keyboard angled diagonally in perspective on a warm pale sandy ivory surface, thick rounded keycaps in off-white with muted burnt-orange terracotta accent keys, subtle gray latin key legends. Beside it a small terracotta plant pot with a single sculptural curving olive-green leafy branch, and two loose cream and burnt-orange keycaps floating just above the tabletop. Keyboard main subject in lower center, plant in upper right. Elegant restrained product photography / high quality 3D render, soft realistic ambient occlusion, long gentle sunlight and shadows from upper left, ceramic and matte plastic materials, warm sophisticated mood. Background a continuous uniform warm pale peach-ivory #f2e8db, no dividing horizon. Close cropped attractive composition that reads well at 600px, plenty of space around the objects. This is an artwork asset, not a screenshot, not a UI mockup. No people, no additional text, no captions, no watermark, no logos, no hearts or childish cartoon characters. Save output to local file if supported.

The image is decorative, not a reference for the Korean keyboard layout. The practice keyboard continues to use the actual two-set Korean mapping in `js/keyboard.js` and `js/hangul.js`.

## Rainbow palette revision

`typing-rainbow.jpg` is the current homepage artwork (1536 × 1024). It was edited with the built-in `image_gen` tool using the previous still life as the edit target and the user-supplied palette as a color reference, then exported to JPEG with `sips`. The original image remains available as `typing-still-life.jpg`.

Colors sampled directly from the reference: orchid `#E1B7FA`, lilac `#B9A7F9`, sky `#B1D4FA`, mint `#B9EBEA`, cream yellow `#F0EDC2`, apricot `#F6C8AD`. The six homepage cards follow this order. Buttons use the lilac swatch with dark text; links use a darker purple for readability.

### Final edit prompt

> Use case: precise-object-edit / color palette adaptation. Image 1 is the EDIT TARGET: existing website hero still life with a mechanical keyboard and potted leafy plant. Image 2 is a COLOR REFERENCE ONLY: six pastel swatches, do not include the swatch card, text or heart in the output. Edit image 1 to use this exact pastel rainbow family: orchid #E1B7FA, lilac #B9A7F9, sky blue #B1D4FA, aqua mint #B9EBEA, pale butter yellow #F0EDC2, apricot #F6C8AD. Preserve the exact subject composition, keyboard geometry and perspective, plant placement, camera angle, rounded tactile keycaps, lighting direction, and premium realistic 3D product render quality. Recolor the keyboard's keycaps in a tasteful soft progression of these six pastel colors from left to right; use dark slate legends for clarity. Keyboard chassis should become porcelain white. Change the terracotta flowerpot to pale matte aqua mint ceramic; keep leaves natural muted green. Recolor the loose keycaps lilac and apricot. Replace the warm brown/beige color cast with fresh bright neutral daylight and a very pale lavender-white background (#FBFAFF). Retain gentle realistic soft shadows. Sophisticated, airy, calm pastel editorial product photography, not cartoon. This is just the artwork asset. Do not add labels, logos, UI, captions, borders, palette swatches, or any new objects. Landscape 3:2 format.
