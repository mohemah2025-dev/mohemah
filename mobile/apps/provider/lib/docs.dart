import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mohemah_core/mohemah_core.dart';

const docMaxBytes = 5 * 1024 * 1024;

/// A document chosen by the applicant (ID or certificate), ready to upload.
class PickedDoc {
  const PickedDoc(this.name, this.bytes, this.contentType);
  final String name;
  final Uint8List bytes;
  final String contentType;

  bool get isPdf => contentType == 'application/pdf';
  UploadFile upload(String field) => UploadFile(field: field, filename: name, bytes: bytes, contentType: contentType);
}

String _typeFor(String name) {
  final n = name.toLowerCase();
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/// Camera, gallery (both compressed on the device) or a PDF file.
Future<PickedDoc?> pickDocument(BuildContext context, String label) async {
  final source = await showModalBottomSheet<String>(
    context: context,
    builder: (c) => SafeArea(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        ListTile(leading: const Icon(Icons.photo_camera_rounded), title: const Text('التقاط صورة'), onTap: () => Navigator.pop(c, 'camera')),
        ListTile(leading: const Icon(Icons.photo_library_rounded), title: const Text('اختيار من الصور'), onTap: () => Navigator.pop(c, 'gallery')),
        ListTile(leading: const Icon(Icons.picture_as_pdf_rounded), title: const Text('ملف PDF'), onTap: () => Navigator.pop(c, 'pdf')),
        const SizedBox(height: 8),
      ]),
    ),
  );
  if (source == null) return null;
  try {
    PickedDoc? doc;
    if (source == 'pdf') {
      final r = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: const ['pdf'], withData: true);
      final f = r?.files.single;
      if (f == null || f.bytes == null) return null;
      doc = PickedDoc(f.name, f.bytes!, 'application/pdf');
    } else {
      final x = await ImagePicker().pickImage(
        source: source == 'camera' ? ImageSource.camera : ImageSource.gallery,
        maxWidth: 1800,
        maxHeight: 1800,
        imageQuality: 82,
      );
      if (x == null) return null;
      final type = _typeFor(x.name);
      final name = type == 'image/jpeg' && !x.name.toLowerCase().endsWith('.jpg') && !x.name.toLowerCase().endsWith('.jpeg') ? '${x.name}.jpg' : x.name;
      doc = PickedDoc(name, await x.readAsBytes(), type);
    }
    if (doc.bytes.length > docMaxBytes) {
      if (context.mounted) showSnack(context, '$label: الحجم الأقصى 5MB', error: true);
      return null;
    }
    return doc;
  } catch (_) {
    if (context.mounted) showSnack(context, 'تعذّر اختيار الملف، تحقق من صلاحيات الكاميرا والصور', error: true);
    return null;
  }
}

/// Tile showing a document slot and its chosen file.
class DocSlot extends StatelessWidget {
  const DocSlot({super.key, required this.label, required this.doc, required this.onPick});
  final String label;
  final PickedDoc? doc;
  final VoidCallback onPick;

  @override
  Widget build(BuildContext context) {
    final d = doc;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: AppCard(
        onTap: onPick,
        padding: const EdgeInsets.all(12),
        child: Row(children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SizedBox(
              width: 56,
              height: 56,
              child: d == null
                  ? Container(color: Brand.muted, child: const Icon(Icons.upload_file_rounded, color: Brand.mutedFg))
                  : d.isPdf
                      ? Container(color: const Color(0xFFFBEDEC), child: const Icon(Icons.picture_as_pdf_rounded, color: Brand.danger))
                      : Image.memory(d.bytes, fit: BoxFit.cover),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label, style: const TextStyle(fontWeight: FontWeight.w800)),
              Text(d == null ? 'صورة واضحة أو ملف PDF (5MB كحد أقصى)' : '${d.name} • ${(d.bytes.length / 1024).round()}KB',
                  maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Brand.mutedFg, fontSize: 12)),
            ]),
          ),
          Icon(d == null ? Icons.add_circle_rounded : Icons.check_circle_rounded, color: d == null ? Brand.primary : Brand.success),
        ]),
      ),
    );
  }
}
