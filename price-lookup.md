# Consultar preços

The menu and home shortcut open a read-only lookup for profiles with access to
products, sales, or field sales. It searches active records already loaded through
the app's authenticated catalog. Results and details use `sale_price`; they never
display purchase cost or write product/sales data.

Name/code lookup works without the image model. Search is accent-insensitive,
prioritizes exact product codes, and paginates results by 20.

Camera and gallery photos are compared with catalog `image_url` pictures using
MobileNet embeddings and cosine similarity. The top six are suggestions, not SKU
identification. Check packaging, code, unit, and size, especially when several
products share packaging. Uploaded photos stay in browser memory and are not sent
to an image-recognition API or saved in the database.

The model loads only on the first photo lookup:

- TensorFlow.js 4.22.0 and MobileNet loader 2.1.1 from `cdn.jsdelivr.net`.
- Official TensorFlow.js MobileNet V2 GraphModel and weight shards from
  `https://storage.googleapis.com/tfjs-models/savedmodel/mobilenet_v2_1.0_224/model.json`.
- Graph input normalization is `[-1, 1]`; embeddings use
  `module_apply_default/MobilenetV2/Logits/AvgPool`.
- Upstream reference: the TensorFlow.js converter
  [`MobileNet demo`](https://github.com/tensorflow/tfjs/blob/master/tfjs-converter/demo/mobilenet/mobilenet.js).

The browser needs Internet access to those hosts. Model fetches time out after
90 seconds, and failure leaves name/code lookup usable. Catalog data URLs work
locally; external HTTPS photos must permit anonymous CORS for canvas inference.
Unavailable images are skipped and reported. Indexing is sequential, cancellable,
and yields between products. Up to 500 embeddings are cached in memory per user
and company; changing an image invalidates that product's vector. Logout clears
photos and vectors.

Camera selection uses a native file input with `capture="environment"`; mobile
browsers decide whether to open the camera directly or offer a chooser. Gallery
selection has no capture hint. Supported inputs are JPEG, PNG and WebP up to 15 MB.
No credentials or new server endpoint are required.

## Browser checks

With Node.js, Playwright and Chromium installed, run:

```sh
CHROMIUM_PATH=/usr/bin/chromium node tests/price-lookup.cjs
```

The test serves the real page locally and isolates Supabase authentication. It
checks the mobile menu, role restrictions, text lookup, active products, price
details, camera/gallery selection, errors, cancellation and vector cache. Its
photo model is a deterministic test double: passing this test does not validate
MobileNet downloads or recognition accuracy. Check those separately with the
actual model and representative catalog photos on a phone.
