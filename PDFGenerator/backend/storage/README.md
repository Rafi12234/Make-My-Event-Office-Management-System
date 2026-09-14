# PDF Generator storage

Runtime-generated content for the PDF Generator module — **not build output,
not source code**. Keep this separate from anything wiped during deployment.

```
storage/
├── generated/         # Final generated PDFs (e.g. MME-2026-000028.pdf)
└── source-images/     # Original uploaded reference photos, kept per document
    └── document-<id>/
        ├── item-1-<uuid>.jpg
        └── item-2-<uuid>.jpg
```

`PDF_GENERATOR_STORAGE_DIR` (see `.env.example` in the backend) can override
this location in production (e.g. a cPanel path outside the deployed app
folder) so generated PDFs and source images survive redeployments. Falls
back to this local `storage/` folder in dev when unset.
