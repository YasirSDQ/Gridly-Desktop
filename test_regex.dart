import 'dart:convert';
void main() {
  var output = '''
Paste the following into your remote machine --->
{"access_token":"ya29.xyz","token_type":"Bearer","refresh_token":"1//abc","expiry":"2023-01-01T00:00:00Z"}
<---End paste
  ''';
  
  final match = RegExp(r'\{.*"access_token".*\}', dotAll: true).firstMatch(output);
  if (match != null) {
    print('Match found!');
    final maybeJson = match.group(0)!;
    try {
      var decoded = jsonDecode(maybeJson);
      print('Decoded success: \');
    } catch (e) {
      print('Decode failed: \');
    }
  } else {
    print('No match');
  }
}
