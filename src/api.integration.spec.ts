import { testClient } from 'hono/testing';
import { describe, it } from 'vitest';
import { app } from './api';
import { computeChecksum } from './file-storage/helpers';

// Helper to generate random buffer data
function generateBuffer(sizeBytes: number): Buffer {
    const buffer = Buffer.alloc(sizeBytes);
    for (let i = 0; i < sizeBytes; i++) {
        buffer[i] = Math.floor(Math.random() * 256);
    }
    return buffer;
}

describe('API', () => {
    const client = testClient(app);

    it('returns 422 if no body is included', async ({ expect }) => {
        const fileName = 'test-small-file.txt';
        const res = await client.upload[':fileName'].$post({ param: { fileName } });

        expect(res.status).toBe(422);
    });

    it('allows a buffer to be uploaded and downloaded with matching checksums', async ({ expect }) => {
        const fileName = 'test-buffer-file.txt';
        const buffer = generateBuffer(1024); // Generate a 1 KB buffer
        const checksum = computeChecksum(buffer); // Compute checksum of the original buffer

        // Upload the buffer
        const uploadRes = await client.upload[':fileName'].$post(
            {
                param: { fileName },
            },
            { init: { body: buffer } }
        );

        expect(uploadRes.status).toBe(200);
        expect(await uploadRes.json()).toEqual({ ok: true });

        // Download the buffer
        const downloadRes = await client.download[':fileName'].$get({ param: { fileName } });

        expect(downloadRes.status).toBe(200);
        expect(downloadRes.headers.get('Content-Type')).toBe('application/octet-stream');
        const downloadedBuffer = Buffer.from(await downloadRes.arrayBuffer());

        // Verify the checksum matches
        const downloadedChecksum = computeChecksum(downloadedBuffer);
        expect(downloadedChecksum).toBe(checksum);
    });
});
