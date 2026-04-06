/**
 * Build HTML email for "your post just went live" notification.
 */
export function buildPostPublishedEmail(
  platform: string,
  captionPreview: string,
  brandName: string
): string {
  const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1)
  const preview = captionPreview.length > 120
    ? captionPreview.slice(0, 120) + '...'
    : captionPreview

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;color:#18181b">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7">
    <div style="background:#18181b;padding:20px 24px">
      <h1 style="margin:0;font-size:16px;font-weight:600;color:#fafafa">NRS Agency</h1>
    </div>
    <div style="padding:24px">
      <p style="margin:0 0 8px;font-size:14px;color:#71717a">Post Published</p>
      <h2 style="margin:0 0 16px;font-size:20px;font-weight:600">Your ${platformLabel} post for ${brandName} is live!</h2>
      <div style="background:#f4f4f5;border-radius:8px;padding:16px;margin-bottom:20px">
        <p style="margin:0;font-size:13px;color:#3f3f46;line-height:1.5">${preview}</p>
      </div>
      <a href="https://notrealsmart.com.au/agency/studio" style="display:inline-block;background:#18181b;color:#fafafa;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500">View in Studio</a>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #e4e4e7">
      <p style="margin:0;font-size:11px;color:#a1a1aa">You can turn off these notifications in Agency Settings.</p>
    </div>
  </div>
</body>
</html>`
}

/**
 * Build HTML email for "your post failed to publish" notification.
 */
export function buildPostFailedEmail(
  platform: string,
  errorMessage: string,
  brandName: string
): string {
  const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1)

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;color:#18181b">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7">
    <div style="background:#18181b;padding:20px 24px">
      <h1 style="margin:0;font-size:16px;font-weight:600;color:#fafafa">NRS Agency</h1>
    </div>
    <div style="padding:24px">
      <p style="margin:0 0 8px;font-size:14px;color:#ef4444">Publishing Failed</p>
      <h2 style="margin:0 0 16px;font-size:20px;font-weight:600">Your ${platformLabel} post for ${brandName} failed to publish</h2>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:20px">
        <p style="margin:0;font-size:13px;color:#991b1b;line-height:1.5">${errorMessage}</p>
      </div>
      <a href="https://notrealsmart.com.au/agency/studio" style="display:inline-block;background:#18181b;color:#fafafa;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500">Review in Studio</a>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #e4e4e7">
      <p style="margin:0;font-size:11px;color:#a1a1aa">You can turn off these notifications in Agency Settings.</p>
    </div>
  </div>
</body>
</html>`
}
