# Generate the pantry sprite sheets

Paste the block below into a Codex session (any directory; it needs no
checkout). It pulls everything from this folder over public links, fans out one
subagent per sheet, checks each result, and leaves nine PNG sheets in
`~/sprite-work/out` for cutting and downscaling.

Codex only spawns subagents when asked, so the prompt asks. Built-in image
generation (`$imagegen`, gpt-image-2) accepts reference images. I have not seen
documentation saying a subagent can call it, so the prompt falls back to running
the sheets one by one.

```text
Generate nine pixel-art sprite sheets for a cooking app, using subagents.

BASE=https://raw.githubusercontent.com/aria-amini/cocochef/refs/heads/t3/more-discovery-sites/scripts/sprites

1. Make ~/sprite-work/{in,out}. With curl, download $BASE/manifest.json and $BASE/rules.md into ~/sprite-work/in. Then download every file the manifest names: each refs[].file, and for each sheet its prompt file. Keep the same relative paths.
2. Spawn one subagent per entry in manifest.sheets, at most 5 at a time. Give each subagent only: the text of rules.md, the text of its sheet's prompt file, and the local paths of that sheet's refs (the sheet's "refs" list). Its job is to generate ONE image with $imagegen (gpt-image-2): the prompt is rules.md followed by the sheet prompt, with the reference images passed as image inputs. Save it as ~/sprite-work/out/<sheet.output>.
3. Each subagent then inspects its own image and regenerates (at most 2 more tries) if any of these is true:
   - the grid is not sheet.grid.columns x sheet.grid.rows, or a cell is empty or holds two icons
   - the background is not flat white, or any text, number, or label lettering appears
   - an icon's outline is open or missing
   - magenta (#FF00FF family) appears in a cell whose manifest cell has recolourable:false, or a cell with recolourable:true has none. Check this with a short Python or ImageMagick pixel count per cell, not by eye.
   When only some cells fail, regenerate the sheet and keep the instruction "same layout, fix cells N and M".
4. If a subagent cannot call image generation, do the sheets yourself one at a time instead. Do not stop.
5. Finish by writing ~/sprite-work/report.md: one line per sheet with pass or fail, the number of tries, and which cells (by manifest name) still fail a check. Do not edit, commit, or push anything else.
```
