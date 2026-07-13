import { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, useColorScheme, Text, Platform, PermissionsAndroid } from 'react-native';
import { Tabs } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Session } from '@supabase/supabase-js';
import { useSafeAreaInsets, SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import LoginScreen from '../components/login-screen';
import RegisterScreen from './register';
import { SettingsProvider, useSettings } from '../lib/settings-context';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { registerBackgroundFetchAsync } from '../lib/background-task';
import AsyncStorage from '@react-native-async-storage/async-storage';

function TabLayoutContent() {
  const { isDark, fontScale } = useSettings();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<'login' | 'register'>('login');

  // Registrar tarefa em segundo plano para widgets na carga inicial do app
  useEffect(() => {
    registerBackgroundFetchAsync();
    
    // Mantém a tela ativa e captura erros para evitar "uncaught in promise: unable to activate keep awake"
    activateKeepAwakeAsync().catch((err) => {
      console.warn('Unable to activate keep awake (safely ignored):', err);
    });

    return () => {
      try {
        deactivateKeepAwake();
      } catch (_) {}
    };
  }, []);

  // Monitora o estado da sessão para iniciar/parar o Foreground Service de Alertas
  useEffect(() => {
    if (session) {
      console.log('TabLayoutContent: Usuário autenticado. Verificando/Iniciando Foreground Service de Alertas...');
      const checkAndStartForeground = async () => {
        // Solicita permissão de notificações em tempo de execução no Android 13+ (API 33+)
        if (Platform.OS === 'android' && Platform.Version >= 33) {
          try {
            const hasPermission = await PermissionsAndroid.check('android.permission.POST_NOTIFICATIONS');
            if (!hasPermission) {
              console.log('TabLayoutContent: Solicitando permissão de notificação...');
              await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS', {
                title: 'Permissão de Notificação',
                message: 'O TnD Scout precisa de permissão para exibir notificações persistentes e manter os widgets atualizados a cada 1 minuto.',
                buttonPositive: 'Permitir',
                buttonNegative: 'Não permitir'
              });
            }
          } catch (e) {
            console.error('Erro ao verificar permissão de notificação:', e);
          }
        }

        try {
          const active = await AsyncStorage.getItem('ns_widgets_foreground_service_active');
          // Inicia por PADRÃO. Só NÃO inicia se o usuário explicitamente desativou (active === 'false')
          if (active !== 'false') {
            const SharedStorage = require('../../modules/shared-storage').default;
            SharedStorage.startForegroundService();
            // Salva o estado como ativo para futuras verificações
            if (active !== 'true') {
              await AsyncStorage.setItem('ns_widgets_foreground_service_active', 'true');
            }
            console.log('TabLayoutContent: Foreground Service de Alertas em tempo real iniciado/confirmado com sucesso pós-autenticação.');
          }
        } catch (e) {
          console.error('Erro ao verificar Foreground Service:', e);
        }
      };
      checkAndStartForeground();
    } else {
      console.log('TabLayoutContent: Usuário desconectado. Parando Foreground Service de Alertas...');
      try {
        const SharedStorage = require('../../modules/shared-storage').default;
        SharedStorage.stopForegroundService();
      } catch (e) {
        console.error('Erro ao parar Foreground Service no logout:', e);
      }
    }
  }, [session]);

  useEffect(() => {
    console.log('TabLayoutContent: Iniciando verificação de autenticação...');
    // 1. Obter sessão inicial com tratamento de erros
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        console.log('TabLayoutContent: Sessão obtida com sucesso:', session ? 'Usuário Autenticado' : 'Sem Usuário');
        setSession(session);
        setLoading(false);
      })
      .catch((err) => {
        console.error('TabLayoutContent: Erro crítico ao carregar sessão Supabase:', err);
        setSession(null);
        setLoading(false);
      });
 
    // 2. Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('TabLayoutContent: Estado de autenticação alterado:', session ? 'Conectado' : 'Desconectado');
      setSession(session);
    });
 
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: isDark ? '#020617' : '#f8fafc' }]}>
        <ActivityIndicator color="#4f46e5" size="large" />
      </View>
    );
  }

  if (!session) {
    return (
      <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        {currentScreen === 'login' ? (
          <LoginScreen onNavigateToRegister={() => setCurrentScreen('register')} />
        ) : (
          <RegisterScreen onNavigateToLogin={() => setCurrentScreen('login')} />
        )}
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: isDark ? '#020617' : '#ffffff',
            borderTopColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#cbd5e1',
            paddingBottom: Platform.OS === 'ios'
              ? (insets.bottom > 0 ? insets.bottom + 4 : 16)
              : (insets.bottom > 0 ? insets.bottom + 8 : 14),
            paddingTop: 8,
            height: Platform.OS === 'ios'
              ? (60 + (insets.bottom > 0 ? insets.bottom : 16))
              : (64 + (insets.bottom > 0 ? insets.bottom : 12)),
          },
          tabBarActiveTintColor: '#4f46e5',
          tabBarInactiveTintColor: isDark ? '#94a3b8' : '#64748b',
          tabBarLabelStyle: {
            fontSize: 10 * fontScale,
            fontWeight: '600',
          }
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 * fontScale }}>📊</Text>,
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Configurações',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 * fontScale }}>⚙️</Text>,
          }}
        />
        {/* Rota de registro oculta do menu de abas */}
        <Tabs.Screen
          name="register"
          options={{
            href: null,
          }}
        />
        {/* Rota do relatório em WebView oculta do menu de abas */}
        <Tabs.Screen
          name="report"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </ThemeProvider>
  );
}

export default function TabLayout() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <TabLayoutContent />
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
