#!/usr/bin/env python3
"""
Download images and prompts from hmvi.top prompt library.
"""

import json
import os
import re
import time
import urllib.request
import urllib.error
from pathlib import Path


def sanitize_filename(name: str, max_len: int = 80) -> str:
    """Remove invalid filename characters."""
    name = re.sub(r'[\\/:*?"<>|\r\n]+', '_', name)
    name = re.sub(r'_+', '_', name).strip('_. ')
    return name[:max_len] if name else 'untitled'


def download_file(url: str, dest: str, retries: int = 3) -> bool:
    """Download a file with retries."""
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = resp.read()
                with open(dest, 'wb') as f:
                    f.write(data)
            return True
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
            else:
                print(f"  FAILED ({url[:60]}...): {e}")
                return False
    return False


def main():
    # Load prompts data
    with open('D:/projects/rainbowpix/prompts.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f"Loaded {len(data)} prompts")

    # Create output directories
    img_dir = Path('D:/projects/rainbowpix/prompt_library/images')
    img_dir.mkdir(parents=True, exist_ok=True)

    # Track results
    results = []
    success = 0
    failed = 0

    for i, entry in enumerate(data):
        entry_id = entry.get('id', f'unknown_{i}')
        title = entry.get('title', '')
        prompt = entry.get('prompt', '')
        image_url = entry.get('output_image_url', '')
        model = entry.get('model', '')
        size = entry.get('size', '')
        view_count = entry.get('view_count', 0)
        created_at = entry.get('created_at', '')

        # Create short filename from ID
        short_id = entry_id[:8]
        ext = '.png'
        if image_url:
            if '.jpg' in image_url or '.jpeg' in image_url:
                ext = '.jpg'
            elif '.webp' in image_url:
                ext = '.webp'
        img_filename = f"{i+1:04d}_{short_id}{ext}"
        img_path = img_dir / img_filename

        # Download image (skip if already exists and non-empty)
        img_ok = False
        if image_url:
            if img_path.exists() and img_path.stat().st_size > 0:
                img_ok = True
            else:
                img_ok = download_file(image_url, str(img_path))

        if img_ok:
            success += 1
        else:
            failed += 1

        results.append({
            'index': i + 1,
            'id': entry_id,
            'title': title,
            'prompt': prompt,
            'image_file': img_filename if img_ok else None,
            'image_url': image_url,
            'model': model,
            'size': size,
            'view_count': view_count,
            'created_at': created_at,
        })

        # Progress
        if (i + 1) % 20 == 0 or i == len(data) - 1:
            print(f"  Progress: {i+1}/{len(data)} | OK: {success} | Failed: {failed}")

        # Small delay to be polite
        time.sleep(0.3)

    # Save clean JSON with all prompt data
    output_json = Path('D:/projects/rainbowpix/prompt_library/prompts.json')
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\nDone!")
    print(f"  Images downloaded: {success}")
    print(f"  Failed: {failed}")
    print(f"  JSON saved to: {output_json}")
    print(f"  Images saved to: {img_dir}")


if __name__ == '__main__':
    main()
