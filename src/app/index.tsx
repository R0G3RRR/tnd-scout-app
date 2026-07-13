import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Modal,
  TextInput,
  AppState,
  AppStateStatus,
  SafeAreaView,
  Platform,
  Alert,
  Animated,
  KeyboardAvoidingView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useSettings } from '../lib/settings-context';
import LogoSvg from '../components/logo-svg';
import SharedStorage from '../../modules/shared-storage';

// Interfaces de tipos
interface Nightscout {
  id: string;
  name: string;
  nightscout_url: string;
  api_secret?: string;
  created_at: string;
}

interface GlucoseInfo {
  sgv: number;
  direction: string;
  date: number;
  loading: boolean;
  error: boolean;
}

// Componente de bolinha pulsante para alertas visuais
const PulsingDot = ({ color, size = 14 }: { color: string; size?: number }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.6,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: size + 8, height: size + 8 }}>
      {/* Anel pulsante externo */}
      <Animated.View
        style={{
          position: 'absolute',
          width: size + 6,
          height: size + 6,
          borderRadius: (size + 6) / 2,
          backgroundColor: color,
          transform: [{ scale: pulseAnim }],
          opacity: opacityAnim,
        }}
      />
      {/* Dot sólido interno */}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 6,
          elevation: 6,
        }}
      />
    </View>
  );
};

const AnimatedGlucoseBadgeRN = ({ sgv, glucStyle, fontScale, error }: { sgv: number, glucStyle: any, fontScale: number, error: boolean }) => {
  const prevSgvRef = useRef(sgv);
  const translateYAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const prev = prevSgvRef.current;
    if (prev !== sgv && prev > 0 && sgv > 0 && !error) {
      const toY = sgv > prev ? -8 : 8;
      const toScale = sgv > prev ? 1.15 : 0.85;

      Animated.sequence([
        Animated.parallel([
          Animated.timing(translateYAnim, {
            toValue: toY,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: toScale,
            duration: 350,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(translateYAnim, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
    prevSgvRef.current = sgv;
  }, [sgv, error]);

  return (
    <Animated.View style={[
      styles.sgvTextContainer,
      {
        transform: [
          { translateY: translateYAnim },
          { scale: scaleAnim }
        ]
      }
    ]}>
      <Text style={[styles.sgvValue, { color: glucStyle.text, fontSize: 26 * fontScale }]}>
        {error || sgv <= 0 ? '--' : sgv}
      </Text>
      <Text style={[styles.sgvUnit, { color: glucStyle.text, fontSize: 8 * fontScale }]}>
        mg/dL
      </Text>
    </Animated.View>
  );
};

export default function Dashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark, fontScale } = useSettings();

  // Estados principais
  const [nightscouts, setNightscouts] = useState<Nightscout[]>([]);
  const [glucoseData, setGlucoseData] = useState<Record<string, GlucoseInfo>>({});
  const [loadingNightscouts, setLoadingNightscouts] = useState(true);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);

  // Estados de Seções Expandidas/Recolhidas
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    hipo: true,
    hiper: true,
    limite: true,
    ideal: true,
    offline: true
  });

  // Estados dos Modais
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [nsToEdit, setNsToEdit] = useState<Nightscout | null>(null);

  // Estados para Modal de Configuração de Notificação Individual do Paciente
  const [isPatientSettingsModalOpen, setIsPatientSettingsModalOpen] = useState(false);
  const [selectedPatientSettings, setSelectedPatientSettings] = useState<Nightscout | null>(null);
  const [individualAlertsEnabled, setIndividualAlertsEnabled] = useState(true);
  const [individualShowInStatus, setIndividualShowInStatus] = useState(true);
  const [patientSettings, setPatientSettings] = useState<Record<string, { alertsEnabled: boolean, showInStatus: boolean }>>({});

  // Campos do Formulário de Cadastro
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');

  // Campos do Formulário de Edição
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editSecret, setEditSecret] = useState('');

  const [submitting, setSubmitting] = useState(false);

  // Efeito para sincronizar os dados de glicose com o SharedStorage dos Widgets nativos
  useEffect(() => {
    if (nightscouts.length === 0) return;

    // Monta a estrutura para salvar no SharedStorage
    const patientsList = nightscouts.map(ns => {
      const gData = glucoseData[ns.id];
      const settings = patientSettings[ns.id] || { alertsEnabled: true, showInStatus: true };
      return {
        id: ns.id,
        name: ns.name,
        url: ns.nightscout_url, // URL para atualização nativa
        apiSecret: ns.api_secret || '', // Repassa o segredo para atualização nativa autenticada
        sgv: gData && !gData.loading && !gData.error ? gData.sgv : 0,
        direction: gData && !gData.loading && !gData.error ? (gData.direction || 'Flat') : 'Flat',
        date: gData && !gData.loading && !gData.error ? gData.date : 0,
        error: gData ? gData.error : false,
        alertsEnabled: settings.alertsEnabled,
        showInStatus: settings.showInStatus
      };
    });

    // Define o paciente principal (o primeiro da lista)
    const defaultPatient = patientsList[0] || null;

    // Obtém o token de sessão ativo do Supabase de forma assíncrona para o service nativo
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token || '';
      
      const syncData = {
        default: defaultPatient,
        patients: patientsList,
        supabaseToken: token,
        updatedAt: Date.now()
      };

      try {
        SharedStorage.setGlucoseData(JSON.stringify(syncData));
        console.log('SharedStorage: Sincronizado com sucesso!', syncData.default?.name, syncData.default?.sgv);
      } catch (e) {
        console.error('SharedStorage: Erro ao sincronizar dados', e);
      }
    }).catch(e => {
      console.error('SharedStorage: Erro ao obter sessão do Supabase', e);
    });
  }, [nightscouts, glucoseData, patientSettings]);

  // Carregar lista de Nightscouts do Supabase
  const fetchNightscouts = async (silent = false) => {
    if (!silent) setLoadingNightscouts(true);
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('id, name, nightscout_url, created_at')
        .order('name', { ascending: true });

      if (error) throw error;
      setNightscouts(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar Nightscouts:', err.message);
    } finally {
      if (!silent) setLoadingNightscouts(false);
    }
  };

  // Buscar glicemia de um Nightscout via API Proxy no Next.js
  const fetchGlucoseForNightscout = async (nightscoutId: string, silent = false) => {
    if (!silent) {
      setGlucoseData(prev => ({
        ...prev,
        [nightscoutId]: prev[nightscoutId]
          ? { ...prev[nightscoutId], loading: true, error: false }
          : { sgv: 0, direction: 'Flat', date: 0, loading: true, error: false }
      }));
    }

    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) return;

      const res = await fetch(`https://tndscout.vercel.app/api/patient/glucose?patientId=${nightscoutId}&t=${Date.now()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      if (!res.ok) throw new Error('Falha na resposta do servidor');

      const data = await res.json();
      setGlucoseData(prev => ({
        ...prev,
        [nightscoutId]: {
          sgv: data.sgv,
          direction: data.direction || 'Flat',
          date: data.date,
          loading: false,
          error: false
        }
      }));
    } catch (err) {
      setGlucoseData(prev => ({
        ...prev,
        [nightscoutId]: {
          sgv: 0,
          direction: 'Flat',
          date: 0,
          loading: false,
          error: true
        }
      }));
    }
  };

  // Atualizar lista e glicemias
  const handleRefreshAll = async () => {
    if (isRefreshingAll) return;
    setIsRefreshingAll(true);
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('id, name, nightscout_url, created_at')
        .order('name', { ascending: true });

      if (error) throw error;
      const updated = data || [];
      setNightscouts(updated);

      if (updated.length > 0) {
        await Promise.all(updated.map(ns => fetchGlucoseForNightscout(ns.id)));
      }
    } catch (err) {
      console.error('Erro ao atualizar todos:', err);
    } finally {
      setIsRefreshingAll(false);
    }
  };

  // Alternar visualização da seção e salvar no AsyncStorage
  const toggleSection = async (section: string) => {
    const nextVal = !expandedSections[section];
    const updated = { ...expandedSections, [section]: nextVal };
    setExpandedSections(updated);
    try {
      await AsyncStorage.setItem('ns_dashboard_expanded_sections', JSON.stringify(updated));
    } catch (err) {
      console.error('Erro ao salvar seções expandidas:', err);
    }
  };

  // Carga inicial
  useEffect(() => {
    fetchNightscouts();
    const loadExpandedSections = async () => {
      try {
        const saved = await AsyncStorage.getItem('ns_dashboard_expanded_sections');
        if (saved) {
          setExpandedSections(JSON.parse(saved));
        }
      } catch (err) {
        console.error('Erro ao ler seções expandidas:', err);
      }
    };
    loadExpandedSections();

    const loadIndividualSettings = async () => {
      try {
        const stored = await AsyncStorage.getItem('tnd_patients_individual_settings');
        if (stored) {
          setPatientSettings(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Erro ao ler tnd_patients_individual_settings:', e);
      }
    };
    loadIndividualSettings();
  }, []);

  // Referência atualizada da lista de pacientes para uso no timer
  const nightscoutsRef = useRef(nightscouts);
  useEffect(() => {
    nightscoutsRef.current = nightscouts;
  }, [nightscouts]);

  // Buscar glicemia apenas para Nightscouts recém-adicionados que não possuem dados em cache
  const nightscoutIds = nightscouts.map(ns => ns.id).join(',');
  useEffect(() => {
    if (nightscouts.length === 0) return;
    nightscouts.forEach(ns => {
      if (!glucoseData[ns.id]) {
        fetchGlucoseForNightscout(ns.id, false);
      }
    });
  }, [nightscoutIds]);

  // Timer de autorefresh silencioso periódico a cada 40 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      if (nightscoutsRef.current.length > 0) {
        console.log('Autorefresh: Atualizando glicemias em segundo plano...');
        nightscoutsRef.current.forEach(ns => {
          fetchGlucoseForNightscout(ns.id, true);
        });
      }
    }, 40000);

    return () => clearInterval(interval);
  }, []);

  // Atualização instantânea ao focar na janela / abrir o app móvel
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        handleRefreshAll();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [nightscouts]);

  // Adicionar Nightscout
  const handleAddNightscout = async () => {
    if (!name.trim() || !url.trim()) {
      Alert.alert('Erro', 'Nome e URL do Nightscout são obrigatórios.');
      return;
    }

    setSubmitting(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error('Sessão expirada. Faça login novamente.');

      let formattedUrl = url.trim();
      if (formattedUrl.endsWith('/')) {
        formattedUrl = formattedUrl.slice(0, -1);
      }

      const res = await fetch('https://tndscout.vercel.app/api/patient', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name.trim(),
          nightscout_url: formattedUrl,
          api_secret: secret.trim()
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao salvar Nightscout.');
      }

      setIsAddModalOpen(false);
      setName('');
      setUrl('');
      setSecret('');
      fetchNightscouts();
      Alert.alert('Sucesso', 'Nightscout cadastrado com sucesso.');
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao salvar Nightscout.');
    } finally {
      setSubmitting(false);
    }
  };

  // Abrir Modal de Edição
  const handleOpenEditModal = (ns: Nightscout) => {
    setNsToEdit(ns);
    setEditName(ns.name);
    setEditUrl(ns.nightscout_url);
    setEditSecret('');
    setIsEditModalOpen(true);
  };

  // Salvar Edição do Nightscout
  const handleEditNightscout = async () => {
    if (!editName.trim() || !editUrl.trim()) {
      Alert.alert('Erro', 'Nome e URL do Nightscout são obrigatórios.');
      return;
    }
    if (!nsToEdit) return;

    setSubmitting(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error('Sessão expirada. Faça login novamente.');

      let formattedUrl = editUrl.trim();
      if (formattedUrl.endsWith('/')) {
        formattedUrl = formattedUrl.slice(0, -1);
      }

      const res = await fetch('https://tndscout.vercel.app/api/patient', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: nsToEdit.id,
          name: editName.trim(),
          nightscout_url: formattedUrl,
          api_secret: editSecret.trim()
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao salvar Nightscout.');
      }

      setIsEditModalOpen(false);
      setNsToEdit(null);
      setEditName('');
      setEditUrl('');
      setEditSecret('');
      fetchNightscouts();
      Alert.alert('Sucesso', 'Nightscout atualizado com sucesso.');
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao editar Nightscout.');
    } finally {
      setSubmitting(false);
    }
  };

  // Excluir Nightscout
  const handleDeleteNightscout = async (nsId: string, nsName: string) => {
    Alert.alert(
      'Confirmar Exclusão',
      `Deseja excluir o Nightscout "${nsName}" permanentemente?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('patients').delete().eq('id', nsId);
              if (error) throw error;
              fetchNightscouts();
              Alert.alert('Sucesso', 'Nightscout removido com sucesso.');
            } catch (err: any) {
              Alert.alert('Erro', err.message || 'Falha ao excluir Nightscout.');
            }
          }
        }
      ]
    );
  };

  // Funções para gerenciar as configurações individuais de notificação do paciente
  const handleOpenPatientSettings = (ns: Nightscout) => {
    setSelectedPatientSettings(ns);
    const settings = patientSettings[ns.id] || { alertsEnabled: true, showInStatus: true };
    setIndividualAlertsEnabled(settings.alertsEnabled);
    setIndividualShowInStatus(settings.showInStatus);
    setIsPatientSettingsModalOpen(true);
  };

  const handleSavePatientSettings = async () => {
    if (!selectedPatientSettings) return;

    const updatedSettings = {
      ...patientSettings,
      [selectedPatientSettings.id]: {
        alertsEnabled: individualAlertsEnabled,
        showInStatus: individualShowInStatus
      }
    };

    setPatientSettings(updatedSettings);
    setIsPatientSettingsModalOpen(false);

    try {
      await AsyncStorage.setItem('tnd_patients_individual_settings', JSON.stringify(updatedSettings));
    } catch (e) {
      console.error('Erro ao salvar configurações individuais:', e);
    }
  };

  // Cores clínicas suaves e contornos minimalistas
  const getGlucoseStyles = (sgv: number, error: boolean) => {
    if (error || sgv <= 0) {
      return {
        bg: isDark ? 'rgba(30, 41, 59, 0.45)' : '#ffffff',
        border: isDark ? 'rgba(255, 255, 255, 0.05)' : '#cbd5e1',
        text: isDark ? '#94a3b8' : '#64748b',
        barColor: '#64748b',
        label: 'OFFLINE',
        group: 'offline'
      };
    }
    if (sgv < 70) {
      return {
        bg: isDark ? 'rgba(15, 23, 42, 0.45)' : '#ffffff',
        border: isDark ? 'rgba(255, 255, 255, 0.05)' : '#cbd5e1',
        text: '#ef4444',
        barColor: '#ef4444',
        label: 'HIPOGLICEMIA',
        group: 'hipo'
      };
    }
    if (sgv <= 180) {
      return {
        bg: isDark ? 'rgba(15, 23, 42, 0.45)' : '#ffffff',
        border: isDark ? 'rgba(255, 255, 255, 0.05)' : '#cbd5e1',
        text: '#0d9488',
        barColor: '#0d9488',
        label: 'NORMAL',
        group: 'ideal'
      };
    }
    return {
      bg: isDark ? 'rgba(15, 23, 42, 0.45)' : '#ffffff',
      border: isDark ? 'rgba(255, 255, 255, 0.05)' : '#cbd5e1',
      text: '#f59e0b',
      barColor: '#f59e0b',
      label: 'HIPERGLICEMIA',
      group: 'hiper'
    };
  };

  // Seta de tendência com estilo colorido
  const getTrendStyle = (dir: string) => {
    switch (dir) {
      case 'DoubleUp':
        return { arrow: '⇈', color: '#ef4444' };
      case 'SingleUp':
        return { arrow: '↑', color: '#f59e0b' };
      case 'FortyFiveUp':
        return { arrow: '↗', color: '#eab308' };
      case 'Flat':
        return { arrow: '→', color: '#0d9488' };
      case 'FortyFiveDown':
        return { arrow: '↘', color: '#eab308' };
      case 'SingleDown':
        return { arrow: '↓', color: '#f87171' };
      case 'DoubleDown':
        return { arrow: '⇊', color: '#ef4444' };
      default:
        return { arrow: '→', color: '#94a3b8' };
    }
  };

  const getMinutesAgo = (date: number) => {
    if (!date) return '--';
    const diff = Math.floor((Date.now() - date) / 60000);
    if (diff < 0) return 'agora';
    if (diff < 60) return `${diff}m atrás`;
    return `${Math.floor(diff / 60)}h atrás`;
  };

  // Separação de grupos para o layout clínico
  const hipoGroup: Nightscout[] = [];
  const hiperGroup: Nightscout[] = [];
  const limiteGroup: Nightscout[] = [];
  const idealGroup: Nightscout[] = [];
  const offlineGroup: Nightscout[] = [];

  nightscouts.forEach(ns => {
    const data = glucoseData[ns.id];
    if (!data || data.loading) {
      idealGroup.push(ns); // Temporário enquanto carrega
    } else {
      const styles = getGlucoseStyles(data.sgv, data.error);
      if (styles.group === 'hipo') hipoGroup.push(ns);
      else if (styles.group === 'hiper') hiperGroup.push(ns);
      else if (styles.group === 'limite') limiteGroup.push(ns);
      else if (styles.group === 'ideal') idealGroup.push(ns);
      else offlineGroup.push(ns);
    }
  });

  // Estilos de Tema
  const stylesTheme = StyleSheet.create({
    container: { backgroundColor: isDark ? '#020617' : '#f1f5f9' },
    text: { color: isDark ? '#f8fafc' : '#0f172a' },
    header: {
      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#ffffff',
      borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0',
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

  // Renderizar o card do Nightscout (Reformulação Premium)
  const renderNightscoutCard = (item: Nightscout) => {
    const data = glucoseData[item.id] || { sgv: 0, direction: 'Flat', date: 0, loading: true, error: false };
    const glucStyle = getGlucoseStyles(data.sgv, data.error);
    const trend = getTrendStyle(data.direction);
    const isOld = !!(data.date && (Date.now() - data.date) > 15 * 60 * 1000);

    return (
      <Pressable
        key={item.id}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: glucStyle.bg,
            borderColor: glucStyle.border,
            opacity: pressed ? 0.9 : 1.0,
          }
        ]}
        onPress={() => router.push({ pathname: '/report', params: { id: item.id, name: item.name, url: item.nightscout_url } })}
      >
        {/* Barra de Status Lateral Esquerda Fina e Elegante */}
        <View style={[styles.cardStatusBar, { backgroundColor: glucStyle.barColor }]} />

        {/* Conteúdo Principal do Card */}
        <View style={styles.cardContent}>
          <View style={styles.cardInfoSection}>
            <Text style={[styles.nsName, stylesTheme.text, { fontSize: 14.5 * fontScale }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.nsUrl, { color: isDark ? '#64748b' : '#94a3b8', fontSize: 10 * fontScale }]} numberOfLines={1}>
              {item.nightscout_url}
            </Text>
            
            {/* Indicador Temporal */}
            {!data.loading && (
              <View>
                <Text style={[styles.cardTimeIndicator, { color: data.error || isOld ? '#ef4444' : (isDark ? '#475569' : '#94a3b8'), fontSize: 8 * fontScale }]}>
                  {data.error ? 'SEM SINAL' : `ATUALIZADO ${getMinutesAgo(data.date).toUpperCase()}`}
                </Text>
                {isOld && !data.error && (
                  <Text style={{ color: '#ef4444', fontSize: 9 * fontScale, fontWeight: '800', marginTop: 4 }}>
                    ⚠️ DISPOSITIVO SEM NOVAS LEITURAS (+15m)
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Exibição Glicêmica e Ações */}
          <View style={styles.cardRightSection}>
            {data.loading ? (
              <ActivityIndicator size="small" color="#4f46e5" />
            ) : (
              <View style={styles.metricsWrapper}>
                {/* Valor SGV Animado */}
                <AnimatedGlucoseBadgeRN 
                  sgv={data.sgv} 
                  glucStyle={glucStyle} 
                  fontScale={fontScale} 
                  error={data.error || data.sgv <= 0} 
                />

                {/* Seta e Alerta */}
                <View style={styles.trendIndicator}>
                  <Text style={[styles.trendArrowText, { color: data.error || isOld ? '#ef4444' : trend.color, fontSize: 16 * fontScale }]}>
                    {data.error || isOld ? '⚠️' : trend.arrow}
                  </Text>
                </View>
              </View>
            )}

            {/* Ações discretas no canto superior/direito */}
            <View style={styles.actionButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  pressed && { opacity: 0.6 }
                ]}
                onPress={() => handleOpenPatientSettings(item)}
              >
                <Text style={styles.actionButtonText}>🔔</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  pressed && { opacity: 0.6 }
                ]}
                onPress={() => handleOpenEditModal(item)}
              >
                <Text style={styles.actionButtonText}>✏️</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  pressed && { opacity: 0.6 }
                ]}
                onPress={() => handleDeleteNightscout(item.id, item.name)}
              >
                <Text style={styles.actionButtonText}>🗑️</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, stylesTheme.container, { paddingTop: Platform.OS === 'android' ? 30 : 0 }]}>
      {/* Header Superior Premium com Logo Oficial em SVG */}
      <View style={[styles.header, stylesTheme.header]}>
        <View style={styles.headerTitleContainer}>
          <LogoSvg size={28} />
          <Text style={[styles.headerTitle, stylesTheme.text, { fontSize: 16 * fontScale, marginLeft: 8 }]}>
            TnD Scout
          </Text>
        </View>
      </View>

      {/* Botão de Recarregar Ampliado no Topo */}
      <View style={styles.refreshBarContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.refreshBarButton,
            {
              backgroundColor: isDark ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.08)',
              borderColor: isDark ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.15)',
              opacity: pressed ? 0.8 : 1.0
            }
          ]}
          onPress={handleRefreshAll}
          disabled={isRefreshingAll}
        >
          {isRefreshingAll ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator size="small" color="#4f46e5" />
              <Text style={[styles.refreshBarText, { fontSize: 10.5 * fontScale, color: '#4f46e5', fontWeight: '800' }]}>
                Sincronizando dados dos Nightscouts...
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 12 * fontScale }}>🔄</Text>
              <Text style={[styles.refreshBarText, { fontSize: 10.5 * fontScale, color: '#4f46e5', fontWeight: '900' }]}>
                RECARREGAR TODOS OS NIGHTSCOUTS
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Lista de Grupos em ScrollView */}
      {loadingNightscouts && nightscouts.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={{ color: isDark ? '#94a3b8' : '#475569', fontSize: 12 * fontScale, marginTop: 10, fontWeight: '600' }}>
            Buscando dados clínicos dos Nightscouts...
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContainer} style={{ flex: 1 }}>
          {nightscouts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={{ color: isDark ? '#64748b' : '#94a3b8', fontSize: 12 * fontScale, textAlign: 'center' }}>
                Nenhum canal Nightscout cadastrado localmente no Supabase.
              </Text>
            </View>
          ) : (
            <>
              {/* 1. Subgrupo Hipoglicemia */}
              {hipoGroup.length > 0 && (
                <View style={styles.groupSection}>
                  <Pressable
                    onPress={() => toggleSection('hipo')}
                    style={({ pressed }) => [
                      styles.groupHeaderPressable,
                      pressed && { opacity: 0.7 }
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <PulsingDot color="#ef4444" size={10} />
                      <Text style={[styles.groupTitle, { color: '#ef4444', fontSize: 10.5 * fontScale, marginBottom: 0 }]}>
                        HIPOGLICEMIA ({hipoGroup.length})
                      </Text>
                    </View>
                    <Text style={[styles.groupToggleIcon, { color: '#ef4444', fontSize: 12 * fontScale }]}>
                      {expandedSections.hipo ? '▲ Ocultar' : '▼ Mostrar'}
                    </Text>
                  </Pressable>
                  {expandedSections.hipo && (
                    <View style={{ marginTop: 8 }}>
                      {hipoGroup.map(renderNightscoutCard)}
                    </View>
                  )}
                </View>
              )}

              {/* 2. Subgrupo Hiperglicemia */}
              {hiperGroup.length > 0 && (
                <View style={styles.groupSection}>
                  <Pressable
                    onPress={() => toggleSection('hiper')}
                    style={({ pressed }) => [
                      styles.groupHeaderPressable,
                      pressed && { opacity: 0.7 }
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <PulsingDot color="#f87171" size={10} />
                      <Text style={[styles.groupTitle, { color: '#f87171', fontSize: 10.5 * fontScale, marginBottom: 0 }]}>
                        HIPERGLICEMIA ({hiperGroup.length})
                      </Text>
                    </View>
                    <Text style={[styles.groupToggleIcon, { color: '#f87171', fontSize: 12 * fontScale }]}>
                      {expandedSections.hiper ? '▲ Ocultar' : '▼ Mostrar'}
                    </Text>
                  </Pressable>
                  {expandedSections.hiper && (
                    <View style={{ marginTop: 8 }}>
                      {hiperGroup.map(renderNightscoutCard)}
                    </View>
                  )}
                </View>
              )}

              {/* 3. Subgrupo Alerta Limite */}
              {limiteGroup.length > 0 && (
                <View style={styles.groupSection}>
                  <Pressable
                    onPress={() => toggleSection('limite')}
                    style={({ pressed }) => [
                      styles.groupHeaderPressable,
                      pressed && { opacity: 0.7 }
                    ]}
                  >
                    <Text style={[styles.groupTitle, { color: '#f97316', fontSize: 10.5 * fontScale, marginBottom: 0 }]}>
                      ⚠️ ALERTA LIMITE ({limiteGroup.length})
                    </Text>
                    <Text style={[styles.groupToggleIcon, { color: '#f97316', fontSize: 12 * fontScale }]}>
                      {expandedSections.limite ? '▲ Ocultar' : '▼ Mostrar'}
                    </Text>
                  </Pressable>
                  {expandedSections.limite && (
                    <View style={{ marginTop: 8 }}>
                      {limiteGroup.map(renderNightscoutCard)}
                    </View>
                  )}
                </View>
              )}

              {/* 4. Subgrupo Ideal */}
              {idealGroup.length > 0 && (
                <View style={styles.groupSection}>
                  <Pressable
                    onPress={() => toggleSection('ideal')}
                    style={({ pressed }) => [
                      styles.groupHeaderPressable,
                      pressed && { opacity: 0.7 }
                    ]}
                  >
                    <Text style={[styles.groupTitle, { color: '#0d9488', fontSize: 10.5 * fontScale, marginBottom: 0 }]}>
                      🟢 NORMAL ({idealGroup.length})
                    </Text>
                    <Text style={[styles.groupToggleIcon, { color: '#0d9488', fontSize: 12 * fontScale }]}>
                      {expandedSections.ideal ? '▲ Ocultar' : '▼ Mostrar'}
                    </Text>
                  </Pressable>
                  {expandedSections.ideal && (
                    <View style={{ marginTop: 8 }}>
                      {idealGroup.map(renderNightscoutCard)}
                    </View>
                  )}
                </View>
              )}

              {/* 5. Subgrupo Offline */}
              {offlineGroup.length > 0 && (
                <View style={styles.groupSection}>
                  <Pressable
                    onPress={() => toggleSection('offline')}
                    style={({ pressed }) => [
                      styles.groupHeaderPressable,
                      pressed && { opacity: 0.7 }
                    ]}
                  >
                    <Text style={[styles.groupTitle, { color: isDark ? '#94a3b8' : '#64748b', fontSize: 10.5 * fontScale, marginBottom: 0 }]}>
                      📴 OFFLINE ({offlineGroup.length})
                    </Text>
                    <Text style={[styles.groupToggleIcon, { color: isDark ? '#94a3b8' : '#64748b', fontSize: 12 * fontScale }]}>
                      {expandedSections.offline ? '▲ Ocultar' : '▼ Mostrar'}
                    </Text>
                  </Pressable>
                  {expandedSections.offline && (
                    <View style={{ marginTop: 8 }}>
                      {offlineGroup.map(renderNightscoutCard)}
                    </View>
                  )}
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* Botão de Cadastrar Fixo Inferior com SafeArea */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          style={({ pressed }) => [
            styles.addButton,
            pressed && { opacity: 0.85 }
          ]}
          onPress={() => setIsAddModalOpen(true)}
        >
          <Text style={[styles.addButtonText, { fontSize: 12 * fontScale }]}>+ ADICIONAR NIGHTSCOUT</Text>
        </Pressable>
      </View>

      {/* Modal de Cadastro de Nightscout */}
      <Modal
        visible={isAddModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsAddModalOpen(false)}
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
                  Cadastrar Conexão Nightscout
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#475569', fontSize: 10 * fontScale }]}>Nome do(a) Diabético(a)</Text>
                  <TextInput
                    style={[styles.input, stylesTheme.input, { fontSize: 12 * fontScale }]}
                    value={name}
                    onChangeText={setName}
                    placeholder="Ex: Milton Leão"
                    placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#475569', fontSize: 10 * fontScale }]}>URL do Nightscout</Text>
                  <TextInput
                    style={[styles.input, stylesTheme.input, { fontSize: 12 * fontScale }]}
                    value={url}
                    onChangeText={setUrl}
                    placeholder="https://exemplo.herokuapp.com"
                    placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#475569', fontSize: 10 * fontScale }]}>API Secret (Criptografada no Banco)</Text>
                  <TextInput
                    style={[styles.input, stylesTheme.input, { fontSize: 12 * fontScale }]}
                    value={secret}
                    onChangeText={setSecret}
                    placeholder="Opcional se leitura for aberta"
                    placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.modalButtons}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalButton,
                      styles.cancelButton,
                      pressed && { opacity: 0.7 }
                    ]}
                    onPress={() => setIsAddModalOpen(false)}
                  >
                    <Text style={[styles.cancelButtonText, { fontSize: 11 * fontScale }]}>CANCELAR</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalButton,
                      styles.saveButton,
                      (pressed || submitting) && { opacity: 0.8 }
                    ]}
                    onPress={handleAddNightscout}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={[styles.saveButtonText, { fontSize: 11 * fontScale }]}>SALVAR CONEXÃO</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal de Edição de Nightscout */}
      <Modal
        visible={isEditModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditModalOpen(false)}
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
                  Editar Conexão Nightscout
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#475569', fontSize: 10 * fontScale }]}>Nome do(a) Diabético(a)</Text>
                  <TextInput
                    style={[styles.input, stylesTheme.input, { fontSize: 12 * fontScale }]}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Ex: Milton Leão"
                    placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#475569', fontSize: 10 * fontScale }]}>URL do Nightscout</Text>
                  <TextInput
                    style={[styles.input, stylesTheme.input, { fontSize: 12 * fontScale }]}
                    value={editUrl}
                    onChangeText={setEditUrl}
                    placeholder="https://exemplo.herokuapp.com"
                    placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#475569', fontSize: 10 * fontScale }]}>Nova API Secret (Deixe em branco para manter)</Text>
                  <TextInput
                    style={[styles.input, stylesTheme.input, { fontSize: 12 * fontScale }]}
                    value={editSecret}
                    onChangeText={setEditSecret}
                    placeholder="Insira para atualizar no servidor"
                    placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.modalButtons}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalButton,
                      styles.cancelButton,
                      pressed && { opacity: 0.7 }
                    ]}
                    onPress={() => { setIsEditModalOpen(false); setNsToEdit(null); }}
                  >
                    <Text style={[styles.cancelButtonText, { fontSize: 11 * fontScale }]}>CANCELAR</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalButton,
                      styles.saveButton,
                      (pressed || submitting) && { opacity: 0.8 }
                    ]}
                    onPress={handleEditNightscout}
                    disabled={submitting}
                  >
                    {submitting ? (
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

      {/* Modal de Configurações de Notificação do Paciente */}
      <Modal
        visible={isPatientSettingsModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsPatientSettingsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, stylesTheme.modalContent]}>
            <Text style={[styles.modalTitle, stylesTheme.text, { fontSize: 18 * fontScale }]}>
              Configurações de {selectedPatientSettings?.name}
            </Text>
            <Text style={{ color: isDark ? '#94a3b8' : '#475569', fontSize: 11 * fontScale, marginBottom: 20 }}>
              Gerencie as regras de notificações e widgets individuais para este paciente.
            </Text>

            {/* Switch de Alertas Individuais */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#e2e8f0' }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[stylesTheme.text, { fontSize: 13 * fontScale, fontWeight: '700' }]}>
                  Alertas de Glicemia (Hipo/Hiper)
                </Text>
                <Text style={{ color: isDark ? '#94a3b8' : '#475569', fontSize: 10 * fontScale, marginTop: 2 }}>
                  Receber alertas push sonoros ou silenciosos de hipoglicemia e hiperglicemia.
                </Text>
              </View>
              <Pressable 
                onPress={() => setIndividualAlertsEnabled(!individualAlertsEnabled)}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: individualAlertsEnabled ? '#0d9488' : (isDark ? 'rgba(255,255,255,0.08)' : '#cbd5e1'),
                  padding: 2,
                  justifyContent: 'center',
                  alignItems: individualAlertsEnabled ? 'flex-end' : 'flex-start'
                }}
              >
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.5, elevation: 2 }} />
              </Pressable>
            </View>

            {/* Switch de Exibição na Barra de Status */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, marginBottom: 20 }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[stylesTheme.text, { fontSize: 13 * fontScale, fontWeight: '700' }]}>
                  Mostrar no Widget / Status
                </Text>
                <Text style={{ color: isDark ? '#94a3b8' : '#475569', fontSize: 10 * fontScale, marginTop: 2 }}>
                  Incluir este paciente no widget geral da tela inicial (Home Screen).
                </Text>
              </View>
              <Pressable 
                onPress={() => setIndividualShowInStatus(!individualShowInStatus)}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: individualShowInStatus ? '#4f46e5' : (isDark ? 'rgba(255,255,255,0.08)' : '#cbd5e1'),
                  padding: 2,
                  justifyContent: 'center',
                  alignItems: individualShowInStatus ? 'flex-end' : 'flex-start'
                }}
              >
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.5, elevation: 2 }} />
              </Pressable>
            </View>

            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.cancelButton,
                  pressed && { opacity: 0.7 }
                ]}
                onPress={() => setIsPatientSettingsModalOpen(false)}
              >
                <Text style={[styles.cancelButtonText, { fontSize: 11 * fontScale }]}>CANCELAR</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.saveButton,
                  pressed && { opacity: 0.8 }
                ]}
                onPress={handleSavePatientSettings}
              >
                <Text style={[styles.saveButtonText, { fontSize: 11 * fontScale }]}>SALVAR</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  refreshBarContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  refreshBarButton: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshBarText: {
    letterSpacing: 0.6,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  groupSection: {
    marginBottom: 20,
  },
  groupTitle: {
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 10,
    paddingLeft: 4,
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: 20,
    borderWidth: 0.5,
    marginBottom: 10,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardStatusBar: {
    width: 6,
    height: '100%',
  },
  cardContent: {
    flex: 1,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardInfoSection: {
    flex: 1,
    marginRight: 10,
  },
  nsName: {
    fontWeight: '800',
  },
  nsUrl: {
    marginTop: 2,
  },
  cardTimeIndicator: {
    marginTop: 6,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metricsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.02)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  sgvTextContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  sgvValue: {
    fontWeight: '900',
    letterSpacing: -1,
  },
  sgvUnit: {
    fontWeight: '700',
    marginLeft: 2,
  },
  trendIndicator: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendArrowText: {
    fontWeight: '900',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 4,
  },
  actionButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 12,
  },
  deleteButton: {
    padding: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  addButton: {
    backgroundColor: '#4f46e5',
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  addButtonText: {
    fontWeight: '900',
    color: '#ffffff',
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
  groupHeaderPressable: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(148, 163, 184, 0.12)',
  },
  groupToggleIcon: {
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
