import React, { useState, useEffect } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, Text, ActivityIndicator, Modal, TextInput, Alert, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { useSettings, FontScaleOption, ThemeOption } from '../lib/settings-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SharedStorage from '../../modules/shared-storage';

export default function SettingsScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const router = useRouter();
  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + 60 + 16,
  };

  const {
    fontScale,
    fontScaleOption,
    themePreference,
    isDark,
    setFontScaleOption,
    setThemePreference,
  } = useSettings();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Estados do Modal de Edição de Perfil
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [profileSubmitting, setProfileSubmitting] = useState(false);

  // Estado do Foreground Service para Widgets a cada 1m (ATIVO por padrão)
  const [foregroundActive, setForegroundActive] = useState(true);

  // Estados para Alertas Clínicos de Glicose
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [alertsSoundEnabled, setAlertsSoundEnabled] = useState(true);
  const [alertsVibrationEnabled, setAlertsVibrationEnabled] = useState(true);
  const [alertHypoLimit, setAlertHypoLimit] = useState(70);
  const [alertHyperLimit, setAlertHyperLimit] = useState(180);
  const [alertSnoozeMinutes, setAlertSnoozeMinutes] = useState(10);
  const [customSnoozeInput, setCustomSnoozeInput] = useState('');

  useEffect(() => {
    const loadServiceState = async () => {
      try {
        const active = await AsyncStorage.getItem('ns_widgets_foreground_service_active');
        // Ativo por padrão: só desativa se explicitamente 'false'
        setForegroundActive(active !== 'false');
      } catch (e) {
        console.error(e);
      }
    };
    loadServiceState();

    const loadAlertSettings = async () => {
      try {
        const enabled = await AsyncStorage.getItem('tnd_alerts_enabled');
        const sound = await AsyncStorage.getItem('tnd_alerts_sound_enabled');
        const vibration = await AsyncStorage.getItem('tnd_alerts_vibration_enabled');
        const hypo = await AsyncStorage.getItem('tnd_alert_hypo_limit');
        const hyper = await AsyncStorage.getItem('tnd_alert_hyper_limit');
        const snooze = await AsyncStorage.getItem('tnd_alert_snooze_minutes');

        if (enabled !== null) setAlertsEnabled(enabled === 'true');
        if (sound !== null) setAlertsSoundEnabled(sound === 'true');
        if (vibration !== null) setAlertsVibrationEnabled(vibration === 'true');
        if (hypo !== null) setAlertHypoLimit(parseInt(hypo, 10));
        if (hyper !== null) setAlertHyperLimit(parseInt(hyper, 10));
        if (snooze !== null) setAlertSnoozeMinutes(parseInt(snooze, 10));
      } catch (e) {
        console.error('Erro ao carregar configurações de alertas:', e);
      }
    };
    loadAlertSettings();

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });
  }, []);

  const handleToggleForeground = async () => {
    const nextState = !foregroundActive;
    setForegroundActive(nextState);
    try {
      await AsyncStorage.setItem('ns_widgets_foreground_service_active', nextState ? 'true' : 'false');
      if (nextState) {
        if (Platform.OS === 'android') {
          const isIgnoring = SharedStorage.isIgnoringBatteryOptimizations();
          if (!isIgnoring) {
            Alert.alert(
              'Otimização de Bateria',
              'Para que a leitura a cada 1 minuto funcione continuamente sem interrupções do sistema, é necessário permitir a execução em segundo plano sem restrições.',
              [
                {
                  text: 'Configurar',
                  onPress: () => {
                    SharedStorage.requestBatteryOptimization();
                    SharedStorage.startForegroundService();
                  }
                },
                {
                  text: 'Agora Não',
                  style: 'cancel',
                  onPress: () => {
                    SharedStorage.startForegroundService();
                  }
                }
              ]
            );
          } else {
            SharedStorage.startForegroundService();
          }
        } else {
          SharedStorage.startForegroundService();
        }
        Alert.alert('Tempo Real Ativado', 'O monitoramento a cada 1 minuto está ativo. Uma notificação fixa aparecerá na barra de status para atualizar os widgets nativos.');
      } else {
        SharedStorage.stopForegroundService();
        Alert.alert('Tempo Real Desativado', 'A atualização a cada 1 minuto foi desativada.');
      }
    } catch (e) {
      console.error('Erro ao alternar Foreground Service:', e);
    }
  };

  const handleUpdateAlerts = async (enabled: boolean, sound: boolean, vibration: boolean, hypo: number, hyper: number, snooze?: number) => {
    const snoozeVal = snooze !== undefined ? snooze : alertSnoozeMinutes;
    setAlertsEnabled(enabled);
    setAlertsSoundEnabled(sound);
    setAlertsVibrationEnabled(vibration);
    setAlertHypoLimit(hypo);
    setAlertHyperLimit(hyper);
    if (snooze !== undefined) setAlertSnoozeMinutes(snooze);
    try {
      await AsyncStorage.setItem('tnd_alerts_enabled', enabled ? 'true' : 'false');
      await AsyncStorage.setItem('tnd_alerts_sound_enabled', sound ? 'true' : 'false');
      await AsyncStorage.setItem('tnd_alerts_vibration_enabled', vibration ? 'true' : 'false');
      await AsyncStorage.setItem('tnd_alert_hypo_limit', hypo.toString());
      await AsyncStorage.setItem('tnd_alert_hyper_limit', hyper.toString());
      await AsyncStorage.setItem('tnd_alert_snooze_minutes', snoozeVal.toString());

      // Sincroniza com o SharedStorage (inclui snooze)
      SharedStorage.setAlertSettings(enabled, sound, vibration, hypo, hyper, snoozeVal);
    } catch (e) {
      console.error('Erro ao salvar configurações de alertas:', e);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Abrir Modal de Edição
  const handleOpenEditProfile = () => {
    if (user) {
      setEditName(user.user_metadata?.full_name || '');
      setEditRole(user.user_metadata?.role_name || 'Médico / Responsável');
      setIsEditProfileOpen(true);
    }
  };

  // Salvar alterações de Perfil e Label no Supabase Auth
  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Erro', 'O nome não pode ficar em branco.');
      return;
    }

    setProfileSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: editName.trim(),
          role_name: editRole.trim() || 'Médico / Responsável'
        }
      });

      if (error) throw error;

      // Buscar o usuário atualizado
      const { data: { user: updatedUser } } = await supabase.auth.getUser();
      setUser(updatedUser);
      setIsEditProfileOpen(false);
      Alert.alert('Sucesso', 'Perfil atualizado com sucesso.');
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao atualizar perfil.');
    } finally {
      setProfileSubmitting(false);
    }
  };

  // Cores dinâmicas para o tema
  const stylesTheme = StyleSheet.create({
    container: { backgroundColor: isDark ? '#020617' : '#f1f5f9' },
    card: {
      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.45)' : '#ffffff',
      borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#cbd5e1',
    },
    text: { color: isDark ? '#f8fafc' : '#0f172a' },
    textSec: { color: isDark ? '#94a3b8' : '#475569' },
    optionButton: {
      backgroundColor: isDark ? 'rgba(2, 6, 23, 0.45)' : '#f8fafc',
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#cbd5e1',
    },
    optionButtonSelected: {
      backgroundColor: '#4f46e5',
      borderColor: '#4f46e5',
    },
    modalContent: {
      backgroundColor: isDark ? '#0f172a' : '#ffffff',
    },
    input: {
      backgroundColor: isDark ? 'rgba(2, 6, 23, 0.45)' : '#f8fafc',
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#cbd5e1',
      color: isDark ? '#f8fafc' : '#0f172a',
    }
  });

  return (
    <ScrollView
      style={[styles.scrollView, stylesTheme.container]}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: Platform.OS === 'android' ? safeAreaInsets.top + 20 : safeAreaInsets.top,
          paddingBottom: insets.bottom,
        }
      ]}
    >
      <View style={styles.container}>
        
        {/* Título de Configurações */}
        <View style={styles.titleContainer}>
          <Text style={[styles.title, stylesTheme.text, { fontSize: 20 * fontScale }]}>
            Configurações
          </Text>
          <Text style={[styles.subtitle, stylesTheme.textSec, { fontSize: 11 * fontScale }]}>
            Gerencie seu perfil de acesso e configurações do Nightscout.
          </Text>
        </View>

        <View style={styles.sectionsWrapper}>
          
          {/* Card de Perfil do Usuário */}
          <Pressable 
            style={[styles.card, stylesTheme.card]}
            onPress={handleOpenEditProfile}
          >
            <Text style={styles.profileIcon}>👨‍⚕️</Text>
            {loading ? (
              <ActivityIndicator size="small" color="#4f46e5" />
            ) : (
              <View style={styles.profileInfo}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[styles.profileName, stylesTheme.text, { fontSize: 14 * fontScale }]}>
                    {user?.user_metadata?.full_name || 'Usuário'}
                  </Text>
                  <Text style={{ fontSize: 11 }}>✏️</Text>
                </View>
                <Text style={[styles.profileEmail, { fontSize: 11 * fontScale }]}>
                  {user?.email || 'Nenhum e-mail conectado'}
                </Text>
                <Text style={[styles.profileRole, { fontSize: 9 * fontScale }]}>
                  {user?.user_metadata?.role_name || 'Monitor'}
                </Text>
              </View>
            )}
          </Pressable>

          {/* Ajuste de Tamanho da Fonte */}
          <View style={[styles.card, stylesTheme.card, { flexDirection: 'column', alignItems: 'stretch' }]}>
            <Text style={[styles.sectionTitle, stylesTheme.text, { fontSize: 13 * fontScale }]}>
              Tamanho do Texto (Fonte)
            </Text>
            <Text style={[styles.sectionDesc, stylesTheme.textSec, { fontSize: 10 * fontScale }]}>
              Ajuste as dimensões de leitura dos dados glicêmicos dos Nightscouts.
            </Text>
            <View style={styles.optionsRow}>
              {(['normal', 'large', 'extraLarge'] as FontScaleOption[]).map((option) => {
                const labelMap: Record<FontScaleOption, string> = {
                  normal: 'Normal',
                  large: 'Grande',
                  extraLarge: 'Extra Grande',
                };
                const isSelected = fontScaleOption === option;
                return (
                  <Pressable
                    key={option}
                    style={[
                      styles.optionButton,
                      stylesTheme.optionButton,
                      isSelected && stylesTheme.optionButtonSelected
                    ]}
                    onPress={() => setFontScaleOption(option)}
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        isSelected ? { color: '#ffffff' } : stylesTheme.text,
                        { fontSize: 11 * fontScale, fontWeight: isSelected ? '800' : '600' }
                      ]}
                    >
                      {labelMap[option]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Ajuste do Tema do Aplicativo */}
          <View style={[styles.card, stylesTheme.card, { flexDirection: 'column', alignItems: 'stretch' }]}>
            <Text style={[styles.sectionTitle, stylesTheme.text, { fontSize: 13 * fontScale }]}>
              Tema do App
            </Text>
            <Text style={[styles.sectionDesc, stylesTheme.textSec, { fontSize: 10 * fontScale }]}>
              Escolha a exibição de cores da interface do seu aplicativo.
            </Text>
            <View style={styles.optionsRow}>
              {(['light', 'dark', 'system'] as ThemeOption[]).map((pref) => {
                const labelMap: Record<ThemeOption, string> = {
                  light: 'Claro',
                  dark: 'Escuro',
                  system: 'Sistema',
                };
                const isSelected = themePreference === pref;
                return (
                  <Pressable
                    key={pref}
                    style={[
                      styles.optionButton,
                      stylesTheme.optionButton,
                      isSelected && stylesTheme.optionButtonSelected
                    ]}
                    onPress={() => setThemePreference(pref)}
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        isSelected ? { color: '#ffffff' } : stylesTheme.text,
                        { fontSize: 11 * fontScale, fontWeight: isSelected ? '800' : '600' }
                      ]}
                    >
                      {labelMap[pref]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Monitoramento a cada 1 minuto (Widgets) */}
          <View style={[styles.card, stylesTheme.card, { flexDirection: 'column', alignItems: 'stretch' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={[styles.sectionTitle, stylesTheme.text, { fontSize: 13 * fontScale, marginBottom: 0 }]}>
                Atualização em Tempo Real (1m)
              </Text>
              <Pressable 
                onPress={handleToggleForeground}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: foregroundActive ? '#0d9488' : (isDark ? 'rgba(255,255,255,0.08)' : '#cbd5e1'),
                  padding: 2,
                  justifyContent: 'center',
                  alignItems: foregroundActive ? 'flex-end' : 'flex-start'
                }}
              >
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.5, elevation: 2 }} />
              </Pressable>
            </View>
            <Text style={[styles.sectionDesc, stylesTheme.textSec, { fontSize: 10 * fontScale }]}>
              Consulta os dados do Nightscout a cada 1 minuto para atualizar os widgets da tela inicial (Home Screen). Exibe uma notificação fixa na barra de status para funcionamento contínuo.
            </Text>
          </View>

          {/* Alertas Clínicos de Hipo e Hiper */}
          <View style={[styles.card, stylesTheme.card, { flexDirection: 'column', alignItems: 'stretch' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.sectionTitle, stylesTheme.text, { fontSize: 13 * fontScale, marginBottom: 2 }]}>
                  Alertas de Glicemia 🚨
                </Text>
                <Text style={[styles.sectionDesc, stylesTheme.textSec, { fontSize: 10 * fontScale, marginBottom: 0 }]}>
                  Avisar quando houver Hipoglicemia ou Hiperglicemia.
                </Text>
              </View>
              <Pressable 
                onPress={() => handleUpdateAlerts(!alertsEnabled, alertsSoundEnabled, alertsVibrationEnabled, alertHypoLimit, alertHyperLimit)}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: alertsEnabled ? '#0d9488' : (isDark ? 'rgba(255,255,255,0.08)' : '#cbd5e1'),
                  padding: 2,
                  justifyContent: 'center',
                  alignItems: alertsEnabled ? 'flex-end' : 'flex-start'
                }}
              >
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.5, elevation: 2 }} />
              </Pressable>
            </View>

            {alertsEnabled && (
              <View style={{ borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0', paddingTop: 12, gap: 12, marginTop: 6 }}>
                {/* Switch de Som */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[stylesTheme.text, { fontSize: 11 * fontScale, fontWeight: '700' }]}>
                      Alertas com Som 🔊
                    </Text>
                    <Text style={[stylesTheme.textSec, { fontSize: 9.5 * fontScale }]}>
                      Tocar som de alerta clínico nas notificações.
                    </Text>
                  </View>
                  <Pressable 
                    onPress={() => handleUpdateAlerts(alertsEnabled, !alertsSoundEnabled, alertsVibrationEnabled, alertHypoLimit, alertHyperLimit)}
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: alertsSoundEnabled ? '#4f46e5' : (isDark ? 'rgba(255,255,255,0.08)' : '#cbd5e1'),
                      padding: 2,
                      justifyContent: 'center',
                      alignItems: alertsSoundEnabled ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.5, elevation: 2 }} />
                  </Pressable>
                </View>

                {/* Switch de Vibração */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[stylesTheme.text, { fontSize: 11 * fontScale, fontWeight: '700' }]}>
                      Alertas com Vibração 📳
                    </Text>
                    <Text style={[stylesTheme.textSec, { fontSize: 9.5 * fontScale }]}>
                      Vibrar o dispositivo nas notificações de alerta.
                    </Text>
                  </View>
                  <Pressable 
                    onPress={() => handleUpdateAlerts(alertsEnabled, alertsSoundEnabled, !alertsVibrationEnabled, alertHypoLimit, alertHyperLimit)}
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: alertsVibrationEnabled ? '#4f46e5' : (isDark ? 'rgba(255,255,255,0.08)' : '#cbd5e1'),
                      padding: 2,
                      justifyContent: 'center',
                      alignItems: alertsVibrationEnabled ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.5, elevation: 2 }} />
                  </Pressable>
                </View>

                {/* Inputs de Limites Clínicos */}
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[stylesTheme.textSec, { fontSize: 9 * fontScale, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 }]}>
                      Hipo (mg/dL)
                    </Text>
                    <TextInput
                      style={[
                        stylesTheme.input,
                        {
                          height: 38,
                          borderRadius: 8,
                          borderWidth: 1,
                          paddingHorizontal: 10,
                          fontSize: 12 * fontScale,
                          fontWeight: '600'
                        }
                      ]}
                      keyboardType="number-pad"
                      value={alertHypoLimit.toString()}
                      onChangeText={(val) => {
                        const parsed = parseInt(val, 10);
                        if (!isNaN(parsed)) {
                          handleUpdateAlerts(alertsEnabled, alertsSoundEnabled, alertsVibrationEnabled, parsed, alertHyperLimit);
                        } else if (val === '') {
                          setAlertHypoLimit(0);
                        }
                      }}
                      onBlur={() => {
                        if (alertHypoLimit <= 0) {
                          handleUpdateAlerts(alertsEnabled, alertsSoundEnabled, alertsVibrationEnabled, 70, alertHyperLimit);
                        } else if (alertHypoLimit >= alertHyperLimit) {
                          Alert.alert('Valor Inválido', 'O limite de hipoglicemia deve ser menor que o de hiperglicemia.');
                          handleUpdateAlerts(alertsEnabled, alertsSoundEnabled, alertsVibrationEnabled, 70, alertHyperLimit);
                        }
                      }}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[stylesTheme.textSec, { fontSize: 9 * fontScale, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 }]}>
                      Hiper (mg/dL)
                    </Text>
                    <TextInput
                      style={[
                        stylesTheme.input,
                        {
                          height: 38,
                          borderRadius: 8,
                          borderWidth: 1,
                          paddingHorizontal: 10,
                          fontSize: 12 * fontScale,
                          fontWeight: '600'
                        }
                      ]}
                      keyboardType="number-pad"
                      value={alertHyperLimit.toString()}
                      onChangeText={(val) => {
                        const parsed = parseInt(val, 10);
                        if (!isNaN(parsed)) {
                          handleUpdateAlerts(alertsEnabled, alertsSoundEnabled, alertsVibrationEnabled, alertHypoLimit, parsed);
                        } else if (val === '') {
                          setAlertHyperLimit(0);
                        }
                      }}
                      onBlur={() => {
                        if (alertHyperLimit <= 0) {
                          handleUpdateAlerts(alertsEnabled, alertsSoundEnabled, alertsVibrationEnabled, alertHypoLimit, 180);
                        } else if (alertHyperLimit <= alertHypoLimit) {
                          Alert.alert('Valor Inválido', 'O limite de hiperglicemia deve ser maior que o de hipoglicemia.');
                          handleUpdateAlerts(alertsEnabled, alertsSoundEnabled, alertsVibrationEnabled, alertHypoLimit, 180);
                        }
                      }}
                    />
                  </View>
                </View>

                {/* Intervalo de Repetição do Beep */}
                <View style={{ borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0', paddingTop: 12, marginTop: 8 }}>
                  <View style={{ marginBottom: 8 }}>
                    <Text style={[stylesTheme.text, { fontSize: 11 * fontScale, fontWeight: '700' }]}>
                      Intervalo de Repetição do Alerta ⏱️
                    </Text>
                    <Text style={[stylesTheme.textSec, { fontSize: 9.5 * fontScale }]}>
                      Tempo entre cada repetição do beep enquanto a glicemia permanecer fora do alvo.
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {[5, 10, 15, 20, 30].map((min) => {
                      const isSelected = alertSnoozeMinutes === min;
                      return (
                        <Pressable
                          key={min}
                          onPress={() => handleUpdateAlerts(alertsEnabled, alertsSoundEnabled, alertsVibrationEnabled, alertHypoLimit, alertHyperLimit, min)}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 10,
                            borderWidth: 1.5,
                            backgroundColor: isSelected ? '#4f46e5' : (isDark ? 'rgba(2, 6, 23, 0.45)' : '#f8fafc'),
                            borderColor: isSelected ? '#4f46e5' : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#cbd5e1'),
                          }}
                        >
                          <Text style={{
                            fontSize: 11 * fontScale,
                            fontWeight: isSelected ? '800' : '600',
                            color: isSelected ? '#ffffff' : (isDark ? '#f8fafc' : '#0f172a'),
                          }}>
                            {min} min
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {/* Input personalizado */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                    <Text style={[stylesTheme.textSec, { fontSize: 9.5 * fontScale, fontWeight: '600' }]}>
                      Ou digite (min):
                    </Text>
                    <TextInput
                      style={[
                        stylesTheme.input,
                        {
                          height: 34,
                          width: 60,
                          borderRadius: 8,
                          borderWidth: 1,
                          paddingHorizontal: 8,
                          fontSize: 12 * fontScale,
                          fontWeight: '700',
                          textAlign: 'center'
                        }
                      ]}
                      keyboardType="number-pad"
                      placeholder={alertSnoozeMinutes.toString()}
                      placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                      value={customSnoozeInput}
                      onChangeText={setCustomSnoozeInput}
                      onBlur={() => {
                        const parsed = parseInt(customSnoozeInput, 10);
                        if (!isNaN(parsed) && parsed >= 1 && parsed <= 120) {
                          handleUpdateAlerts(alertsEnabled, alertsSoundEnabled, alertsVibrationEnabled, alertHypoLimit, alertHyperLimit, parsed);
                        } else if (customSnoozeInput !== '') {
                          Alert.alert('Valor Inválido', 'O intervalo deve ser entre 1 e 120 minutos.');
                        }
                        setCustomSnoozeInput('');
                      }}
                    />
                    <View style={{
                      backgroundColor: isDark ? 'rgba(79, 70, 229, 0.15)' : 'rgba(79, 70, 229, 0.08)',
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 8,
                    }}>
                      <Text style={{ fontSize: 10 * fontScale, fontWeight: '800', color: '#6366f1' }}>
                        Atual: {alertSnoozeMinutes} min
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Seção sobre o App */}
          <View style={[styles.card, stylesTheme.card, { flexDirection: 'column', alignItems: 'stretch' }]}>
            <Text style={[styles.sectionTitle, stylesTheme.text, { fontSize: 13 * fontScale }]}>
              Sobre o TnD Scout
            </Text>
            <Text style={[styles.aboutText, stylesTheme.textSec, { fontSize: 10.5 * fontScale }]}>
              O <Text style={[stylesTheme.text, { fontWeight: 'bold' }]}>TnD Scout Mobile</Text> permite que você, seus familiares e responsáveis acompanhem em tempo real as glicemias do canal cadastrado no Nightscout.
            </Text>
            <Text style={[styles.aboutText, stylesTheme.textSec, { fontSize: 10.5 * fontScale, marginTop: 8 }]}>
              Todos os canais de <Text style={[stylesTheme.text, { fontWeight: 'bold' }]}>Nightscouts</Text> adicionados ou monitorados no aplicativo móvel são salvos na nuvem do Supabase, sincronizando instantaneamente com a plataforma.
            </Text>
          </View>

          {/* Botões de Acesso / Sair */}
          {user ? (
            <Pressable style={styles.logoutButton} onPress={handleLogout}>
              <Text style={[styles.logoutButtonText, { fontSize: 12 * fontScale }]}>SAIR DA CONTA</Text>
            </Pressable>
          ) : (
            <Pressable style={[styles.logoutButton, { backgroundColor: '#4f46e5', borderColor: '#4338ca' }]} onPress={() => router.push('/register')}>
              <Text style={[styles.logoutButtonText, { fontSize: 12 * fontScale, color: '#ffffff' }]}>CRIAR UMA CONTA</Text>
            </Pressable>
          )}

        </View>
      </View>

      {/* Modal de Edição de Perfil do Médico / Label */}
      <Modal
        visible={isEditProfileOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditProfileOpen(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalOverlay}>
            <ScrollView
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.modalContent, stylesTheme.modalContent]}>
                <Text style={[styles.modalTitle, stylesTheme.text, { fontSize: 18 * fontScale }]}>
                  Editar Perfil de Usuário
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#475569', fontSize: 10 * fontScale }]}>Nome Completo</Text>
                  <TextInput
                    style={[styles.input, stylesTheme.input, { fontSize: 12 * fontScale }]}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Ex: Dra. Ana Paula"
                    placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#475569', fontSize: 10 * fontScale }]}>Relação com o Paciente (Ex: Próprio, Mãe, Pai, Médico)</Text>
                  <TextInput
                    style={[styles.input, stylesTheme.input, { fontSize: 12 * fontScale }]}
                    value={editRole}
                    onChangeText={setEditRole}
                    placeholder="Ex: Próprio, Mãe, Pai, Médico"
                    placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                  />
                </View>

                <View style={styles.modalButtons}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalButton,
                      styles.cancelButton,
                      pressed && { opacity: 0.7 }
                    ]}
                    onPress={() => setIsEditProfileOpen(false)}
                  >
                    <Text style={[styles.cancelButtonText, { fontSize: 11 * fontScale }]}>CANCELAR</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalButton,
                      styles.saveButton,
                      (pressed || profileSubmitting) && { opacity: 0.8 }
                    ]}
                    onPress={handleSaveProfile}
                    disabled={profileSubmitting}
                  >
                    {profileSubmitting ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={[styles.saveButtonText, { fontSize: 11 * fontScale }]}>SALVAR ALTERAÇÕES</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
  },
  container: {
    flex: 1,
    paddingBottom: 40,
  },
  titleContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  title: {
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subtitle: {
    textAlign: 'center',
    fontWeight: '500',
  },
  sectionsWrapper: {
    gap: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  profileIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontWeight: '800',
  },
  profileEmail: {
    color: '#6366f1',
    marginTop: 2,
    fontWeight: '700',
  },
  profileRole: {
    color: '#94a3b8',
    marginTop: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontWeight: '800',
    marginBottom: 4,
  },
  sectionDesc: {
    fontWeight: '500',
    marginBottom: 12,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  optionButton: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionButtonText: {
    textAlign: 'center',
  },
  aboutText: {
    lineHeight: 16,
  },
  logoutButton: {
    backgroundColor: '#ef4444',
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  logoutButtonText: {
    color: '#ffffff',
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontWeight: '900',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    width: '100%',
    height: 46,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.15)',
    marginRight: 10,
  },
  cancelButtonText: {
    color: '#ef4444',
    fontWeight: '800',
  },
  saveButton: {
    backgroundColor: '#4f46e5',
    marginLeft: 10,
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
