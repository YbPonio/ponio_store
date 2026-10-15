---
title: Perceptual Image Recognition
type: concept
created: 2026-10-15
updated: 2026-10-15
sources:
  - "[[sources/karpathy-llm-wiki]]"
tags:
  - computer-vision
  - image-matching
  - pos-features
---

# Perceptual Image Recognition

Summary: An on-device visual matching subsystem that identifies retail products by comparing captured camera frames or photo uploads against catalog reference images using difference hashing, color histograms, and luminance grids.

## Technical Architecture

The matching engine in `src/services/visual-recognition.service.js` extracts three complementary feature vectors from any image source:

1. Perceptual Difference Hash (dHash):
   - Resizes image to 17x16 grayscale.
   - Compares horizontal adjacent pixels to yield a 256-bit structural fingerprint invariant to minor lighting or scale variations.
2. Color Profile Histogram:
   - Quantizes RGB channels into a 64-bin normalized unit vector.
   - Computes cosine similarity to distinguish product packaging palettes.
3. 8x8 Luminance Distribution Matrix:
   - Evaluates spatial light distribution to verify composition balance.
4. Composite Match Score:
   - Combines structural hash similarity (45%), color profile correlation (40%), and luminance alignment (15%) into a unified confidence percentage.

## Integration Touchpoints

- POS Catalog: "Visual Match" button and F7 keyboard shortcut trigger real-time camera or photo matching, with direct "Add to Cart" workflow.
- Price Checker: "Photo Match" button allows verifying pricing and inventory without locating barcodes.
- Inventory Management: Dedicated toolbar match button for quick product inspection.
- Product Form: Direct local photo upload and live camera snap for associating reference images with products.

## Benefits Over Pure Barcode Scanning

- Operates effectively on unbarcoded items, fresh produce, bulk goods, or damaged labels.
- Completely client-side execution running via HTML5 Canvas in under 50 milliseconds.
- Zero external cloud API calls, zero bandwidth overhead for matching, and complete offline capability.

## Related Pages

- Architectural Model: [[concepts/llm-wiki-pattern]]
- Master Catalog: [[index]]
