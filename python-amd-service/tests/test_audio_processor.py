import unittest

from services.audio_processor import AudioBuffer, AudioBufferConfig


class AudioBufferTestCase(unittest.TestCase):
    def test_ready_when_window_reached(self):
        config = AudioBufferConfig(sample_rate=8000, window_seconds=1)
        buffer = AudioBuffer(config)

        chunk = b"\xff" * 4000
        self.assertFalse(buffer.append(chunk))
        self.assertTrue(buffer.append(chunk))

    def test_get_bytes_resets_buffer(self):
        config = AudioBufferConfig(sample_rate=8000, window_seconds=0.5)
        buffer = AudioBuffer(config)

        buffer.append(b"\x00" * 4000)
        data = buffer.get_bytes()

        self.assertEqual(len(data), 4000)
        self.assertEqual(len(buffer), 0)


if __name__ == "__main__":
    unittest.main()

