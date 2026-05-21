import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:velofit/features/profile/trainee_profile.dart';
import 'package:velofit/features/profile/trainee_profile_repository.dart';
import 'package:velofit/utils/authed_http_client.dart';

class _FakeHttp extends Mock implements AuthedHttpClient {}

void main() {
  setUpAll(() {
    registerFallbackValue(<String, dynamic>{});
  });

  group('HttpTraineeProfileRepository.fetch', () {
    test('parses /api/me/profile response', () async {
      final http = _FakeHttp();
      when(() => http.get<Map<String, dynamic>>('/api/me/profile')).thenAnswer(
        (_) async => {
          'profile': {
            'phone': '+972501234567',
            'introText': 'הצגה עצמית',
            'photoUrl': null,
            'dateOfBirth': '1992-04-08',
            'heightCm': 168,
            'weightKg': 65,
            'goals': 'לרדת 5 קילו',
            'medical': 'אין',
          }
        },
      );

      final repo = HttpTraineeProfileRepository(http);
      final p = await repo.fetch();

      expect(p.phone, '+972501234567');
      expect(p.dateOfBirth, '1992-04-08');
      expect(p.heightCm, 168);
      expect(p.weightKg, 65);
      expect(p.goals, 'לרדת 5 קילו');
      expect(p.medical, 'אין');
    });

    test('handles all-null payload', () async {
      final http = _FakeHttp();
      when(() => http.get<Map<String, dynamic>>('/api/me/profile')).thenAnswer(
        (_) async => {
          'profile': {
            'phone': null,
            'introText': null,
            'photoUrl': null,
            'dateOfBirth': null,
            'heightCm': null,
            'weightKg': null,
            'goals': null,
            'medical': null,
          }
        },
      );

      final p = await HttpTraineeProfileRepository(http).fetch();

      expect(p.phone, isNull);
      expect(p.heightCm, isNull);
      expect(p.weightKg, isNull);
      expect(p.dateOfBirth, isNull);
      expect(p.goals, isNull);
      expect(p.medical, isNull);
    });
  });

  group('HttpTraineeProfileRepository.update', () {
    test('PATCHes only the fields present in the patch', () async {
      Map<String, dynamic>? sent;
      final http = _FakeHttp();
      when(() => http.patch<Map<String, dynamic>>(
            '/api/me/profile',
            data: any(named: 'data'),
          )).thenAnswer((inv) async {
        sent = inv.namedArguments[#data] as Map<String, dynamic>;
        return {
          'profile': {
            'phone': '+972500000000',
            'introText': null,
            'photoUrl': null,
            'dateOfBirth': null,
            'heightCm': 170,
            'weightKg': null,
            'goals': null,
            'medical': null,
          }
        };
      });

      final result = await HttpTraineeProfileRepository(http).update(
        const TraineeProfilePatch(phone: '+972500000000', heightCm: 170),
      );

      expect(sent, {'phone': '+972500000000', 'heightCm': 170});
      expect(result.phone, '+972500000000');
      expect(result.heightCm, 170);
    });

    test('empty patch sends empty body', () async {
      Map<String, dynamic>? sent;
      final http = _FakeHttp();
      when(() => http.patch<Map<String, dynamic>>(
            '/api/me/profile',
            data: any(named: 'data'),
          )).thenAnswer((inv) async {
        sent = inv.namedArguments[#data] as Map<String, dynamic>;
        return {
          'profile': {
            'phone': null,
            'introText': null,
            'photoUrl': null,
            'dateOfBirth': null,
            'heightCm': null,
            'weightKg': null,
            'goals': null,
            'medical': null,
          }
        };
      });

      await HttpTraineeProfileRepository(http).update(const TraineeProfilePatch());

      expect(sent, <String, dynamic>{});
    });
  });
}
