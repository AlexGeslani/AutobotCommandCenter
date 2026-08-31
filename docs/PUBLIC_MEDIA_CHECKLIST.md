# Public media release checklist

Automated media scanning is defense in depth, not proof that an image or video is safe. `npm run security:media` inventories candidate raster/video assets, full-decodes them, inspects embedded metadata, extracts representative moving-image frames, and scans visible text for high-confidence secret and private-infrastructure patterns. CI requires Tesseract OCR and ExifTool; macOS development can use Apple Vision OCR with FFprobe metadata inspection.

Before publishing or replacing any screenshot, GIF, or video:

- [ ] Capture from the exact release candidate using deterministic sanitized fixtures or an explicitly authorized dated aggregate snapshot.
- [ ] Confirm no credentials, account identity, prompts, billing/quota data, raw payloads, raw logs, private hostnames/IPs, local paths, email addresses, or personal visitor data are visible.
- [ ] Review a chronological contact sheet covering the opening, every scene transition, representative scroll positions, and the final frame.
- [ ] Confirm the capture disclosure remains legible and accurately distinguishes illustrative fixtures from authorized dated aggregates.
- [ ] Inspect metadata and require a clean full decode with `npm run security:media`.
- [ ] Verify titles, captions, repository links, model/benchmark labels, dates, and accessibility text against the current application and evidence.
- [ ] Confirm narration is described only as an authorized original synthetic voice, and that no copyrighted clip, soundtrack, or unapproved third-party logo was introduced.
- [ ] Re-run the scanner after the final render; changing or re-encoding an asset invalidates the prior result.

OCR can miss stylized, animated, low-contrast, very small, or briefly displayed text. Representative-frame extraction can miss a short-lived disclosure between samples. Human review of the complete final cut remains required.
