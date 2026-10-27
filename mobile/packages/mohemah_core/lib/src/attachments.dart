import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart' hide Text;

import 'i18n.dart';
import 'package:image_picker/image_picker.dart';
import 'package:record/record.dart';

import 'api.dart';
import 'config.dart';
import 'models.dart';
import 'theme.dart';
import 'widgets.dart';

/// Photos (thumbnails, tap to enlarge) and a voice note (tap to play in the browser player).
class AttachmentStrip extends StatelessWidget {
  const AttachmentStrip({super.key, required this.items});
  final List<OrderAttachment> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();
    final images = items.where((a) => !a.isAudio).toList();
    final audios = items.where((a) => a.isAudio).toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      if (images.isNotEmpty)
        SizedBox(
          height: 78,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: images.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (_, i) => GestureDetector(
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => _ImageViewer(url: absUrl(images[i].url)))),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.network(absUrl(images[i].url), width: 78, height: 78, fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(width: 78, height: 78, color: Brand.muted, child: const Icon(Icons.broken_image_outlined))),
              ),
            ),
          ),
        ),
      for (final a in audios)
        Padding(
          padding: const EdgeInsets.only(top: 8),
          child: OutlinedButton.icon(
            onPressed: () => openUrl(context, absUrl(a.url)),
            icon: const Icon(Icons.play_circle_outline),
            label: const Text('تشغيل الرسالة الصوتية'),
          ),
        ),
    ]);
  }
}

class _ImageViewer extends StatelessWidget {
  const _ImageViewer({required this.url});
  final String url;
  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(backgroundColor: Colors.black, foregroundColor: Colors.white),
        body: Center(child: InteractiveViewer(maxScale: 5, child: Image.network(url))),
      );
}

/// Records a short voice note (up to [maxSeconds]) as 16 kHz mono WAV bytes. Works on Android, iOS and web.
class VoiceNoteRecorder {
  final AudioRecorder _rec = AudioRecorder();
  final BytesBuilder _pcm = BytesBuilder(copy: false);
  StreamSubscription<Uint8List>? _sub;
  Timer? _limit;
  static const sampleRate = 16000;

  Future<bool> start({int maxSeconds = 90, VoidCallback? onLimit}) async {
    if (!await _rec.hasPermission()) return false;
    _pcm.clear();
    final stream = await _rec.startStream(const RecordConfig(encoder: AudioEncoder.pcm16bits, sampleRate: sampleRate, numChannels: 1));
    _sub = stream.listen(_pcm.add);
    _limit = Timer(Duration(seconds: maxSeconds), () => onLimit?.call());
    return true;
  }

  /// Stops and returns the WAV file bytes (null when nothing was recorded).
  Future<Uint8List?> stop() async {
    _limit?.cancel();
    await _rec.stop();
    await _sub?.cancel();
    _sub = null;
    final pcm = _pcm.takeBytes();
    if (pcm.length < sampleRate) return null; // shorter than half a second
    return _wav(pcm);
  }

  Future<void> dispose() async {
    _limit?.cancel();
    await _sub?.cancel();
    await _rec.dispose();
  }

  static Uint8List _wav(Uint8List pcm) {
    final h = ByteData(44);
    void str(int o, String s) {
      for (var i = 0; i < s.length; i++) {
        h.setUint8(o + i, s.codeUnitAt(i));
      }
    }

    str(0, 'RIFF');
    h.setUint32(4, 36 + pcm.length, Endian.little);
    str(8, 'WAVE');
    str(12, 'fmt ');
    h.setUint32(16, 16, Endian.little);
    h.setUint16(20, 1, Endian.little);
    h.setUint16(22, 1, Endian.little);
    h.setUint32(24, sampleRate, Endian.little);
    h.setUint32(28, sampleRate * 2, Endian.little);
    h.setUint16(32, 2, Endian.little);
    h.setUint16(34, 16, Endian.little);
    str(36, 'data');
    h.setUint32(40, pcm.length, Endian.little);
    final b = BytesBuilder(copy: false)
      ..add(h.buffer.asUint8List())
      ..add(pcm);
    return b.takeBytes();
  }
}

/// A photo chosen from the camera or the gallery (compressed on the device), ready to upload.
class PickedImage {
  const PickedImage(this.name, this.bytes, this.contentType);
  final String name;
  final Uint8List bytes;
  final String contentType;
  UploadFile upload(String field) => UploadFile(field: field, filename: name, bytes: bytes, contentType: contentType);
}

/// Camera or gallery sheet; returns a JPEG/PNG up to 6MB, or null.
Future<PickedImage?> pickPhoto(BuildContext context) async {
  final source = await showModalBottomSheet<ImageSource>(
    context: context,
    builder: (c) => SafeArea(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        ListTile(leading: const Icon(Icons.photo_camera_outlined), title: const Text('التقاط صورة'), onTap: () => Navigator.pop(c, ImageSource.camera)),
        ListTile(leading: const Icon(Icons.photo_library_outlined), title: const Text('اختيار من الصور'), onTap: () => Navigator.pop(c, ImageSource.gallery)),
      ]),
    ),
  );
  if (source == null) return null;
  try {
    final x = await ImagePicker().pickImage(source: source, maxWidth: 1600, maxHeight: 1600, imageQuality: 80);
    if (x == null) return null;
    final bytes = await x.readAsBytes();
    if (bytes.length > 6 * 1024 * 1024) {
      if (context.mounted) showSnack(context, 'حجم الصورة الأقصى 6MB', error: true);
      return null;
    }
    final png = x.name.toLowerCase().endsWith('.png');
    return PickedImage(png ? x.name : (x.name.toLowerCase().endsWith('.jpg') || x.name.toLowerCase().endsWith('.jpeg') ? x.name : '${x.name}.jpg'), bytes, png ? 'image/png' : 'image/jpeg');
  } catch (_) {
    if (context.mounted) showSnack(context, 'تعذّر اختيار الصورة، تحقق من صلاحيات الكاميرا والصور', error: true);
    return null;
  }
}
