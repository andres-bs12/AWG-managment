package com.artwithgab.awg_tracking;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;

/** Real, decodable test images (the photo store checks JPEG/PNG really decode). */
final class TestImages {
    private TestImages() {}

    /** A noisy 256x256 JPEG cut inside its compressed scan data. */
    static byte[] truncatedJpeg() {
        try {
            BufferedImage img = new BufferedImage(256, 256, BufferedImage.TYPE_INT_RGB);
            java.util.Random r = new java.util.Random(7);
            for (int y = 0; y < 256; y++) for (int x = 0; x < 256; x++) img.setRGB(x, y, r.nextInt());
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(img, "jpg", out);
            byte[] full = out.toByteArray();
            return java.util.Arrays.copyOf(full, full.length * 3 / 4);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    static byte[] jpeg() {
        try {
            BufferedImage img = new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(img, "jpg", out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
