# pullapprove-browser-extension

This browser extension embeds PullApprove information directly into the GitHub UI.

[![](https://storage.googleapis.com/chrome-gcs-uploader.appspot.com/image/WlD8wC6g8khYWPJUsQceQkhXSlv1/UV4C4ybeBTsZt43U4xis.png)](https://chrome.google.com/webstore/detail/pullapprove/jfcmjfiigpabjhaacjpnlihifgfodjhj)

When viewing a pull request you'll see the PullApprove review status, next
steps, and scopes at the top of the sidebar, with a link through to the full
review in PullApprove. Pull requests on PullApprove v3 keep the report
summary the extension has always shown (`components/v3`); PullApprove 5
support lives separately in `components/v5`.

On the "Files changed" tab, files in your PullApprove scopes are marked, and an
**All / Mine** toggle under the file filter hides everything else,
so you can review just what's yours without leaving GitHub.

![](example.png)

![](example-files.png)

To use it, connect the extension to your PullApprove account once in each
browser: open a pull request and click **Connect** in the PullApprove sidebar,
or go to https://5.pullapprove.com/extension/connect/. To disconnect a
browser, go to **My account** on PullApprove.

## Development

```
npm install
npm run build        # or `npm start` to rebuild on change
```

Then in Chrome open `chrome://extensions`, turn on **Developer mode**, click
**Load unpacked**, and pick this directory. An unpacked build reloads itself
when `dist/content.js` changes, so after a rebuild just refresh the GitHub tab
(twice: the first request is what notices the new build). That only watches
`dist/content.js`: after changing `connect.js`, reload the extension from
`chrome://extensions` yourself.
