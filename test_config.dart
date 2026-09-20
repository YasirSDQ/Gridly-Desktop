import 'package:http/http.dart' as http;
import 'dart:convert';

void main() async {
  final url = 'http://localhost:5572/config/create';
  final response = await http.post(
    Uri.parse(url),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + base64Encode(utf8.encode('admin:gridly2024')),
    },
    body: jsonEncode({
      'name': 'TestAPI2',
      'type': 'drive',
      'parameters': {
        'scope': 'drive',
        'config_is_local': 'false',
      }
    }),
  );
  print(response.statusCode);
  print(response.body);
}
