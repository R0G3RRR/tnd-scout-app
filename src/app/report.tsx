import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  Platform,
  Modal,
  TextInput,
  Alert,
  Animated,
  Linking,
  KeyboardAvoidingView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from '../lib/supabase';
import { useSettings } from '../lib/settings-context';

const { width: screenWidth } = Dimensions.get('window');

// Função utilitária para normalizar texto (remover acentos para busca)
const normalizeText = (text: string): string => {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
};

// Interfaces
interface GlucoseEntry {
  sgv: number;
  direction: string;
  date: number;
  dateString: string;
}

interface Treatment {
  _id: string;
  created_at: string;
  timestamp?: string;
  eventType: string;
  carbs?: number;
  insulin?: number;
  glucose?: number;
  notes?: string;
  enteredBy?: string;
}

interface MealFood {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  carbs: number;
  prot: number;
  fat: number;
}

const FOOD_LIBRARY = [
            // CEREAIS, GRÃOS E TUBÉRCULOS (100g ou colher)
            { id: "arroz_branco", name: "Arroz Branco Cozido", unit: "gramas", ratio: 100, carbs: 28.2, prot: 2.5, fat: 0.2 },
            { id: "arroz_integral", name: "Arroz Integral Cozido", unit: "gramas", ratio: 100, carbs: 25.8, prot: 2.6, fat: 1.0 },
            { id: "arroz_parboilizado", name: "Arroz Parboilizado Cozido", unit: "gramas", ratio: 100, carbs: 27.2, prot: 2.4, fat: 0.2 },
            { id: "cuscuz_milho", name: "Cuscuz de Milho Cozido", unit: "gramas", ratio: 100, carbs: 25.3, prot: 2.2, fat: 0.7 },
            { id: "macarrao", name: "Macarrão Branco Cozido", unit: "gramas", ratio: 100, carbs: 30.8, prot: 5.8, fat: 0.9 },
            { id: "macarrao_integral", name: "Macarrão Integral Cozido", unit: "gramas", ratio: 100, carbs: 26.5, prot: 5.3, fat: 0.5 },
            { id: "batata_inglesa", name: "Batata Inglesa Cozida", unit: "gramas", ratio: 100, carbs: 14.7, prot: 1.8, fat: 0.0 },
            { id: "batata_doce", name: "Batata Doce Cozida", unit: "gramas", ratio: 100, carbs: 18.4, prot: 1.5, fat: 0.1 },
            { id: "batata_baroa", name: "Batata Baroa/Mandioquinha", unit: "gramas", ratio: 100, carbs: 27.2, prot: 0.9, fat: 0.2 },
            { id: "mandioca", name: "Mandioca/Aipim Cozido", unit: "gramas", ratio: 100, carbs: 30.0, prot: 0.6, fat: 0.2 },
            { id: "inhame", name: "Inhame Cozido", unit: "gramas", ratio: 100, carbs: 23.2, prot: 2.1, fat: 0.2 },
            { id: "quinoa", name: "Quinoa Cozida", unit: "gramas", ratio: 100, carbs: 21.3, prot: 4.4, fat: 1.9 },
            { id: "milho_verde", name: "Milho Verde Cozido", unit: "gramas", ratio: 100, carbs: 19.0, prot: 3.2, fat: 1.2 },
            { id: "aveia_flocos", name: "Aveia em Flocos", unit: "unidades", ratio: 1, carbs: 9.0, prot: 2.1, fat: 1.1 },
            { id: "farinha_mandioca", name: "Farinha de Mandioca", unit: "unidades", ratio: 1, carbs: 12.0, prot: 0.2, fat: 0.0 },
            { id: "farinha_linhaca", name: "Farinha de Linhaça", unit: "unidades", ratio: 1, carbs: 4.5, prot: 3.0, fat: 6.0 },
            { id: "farofa_pronta", name: "Farofa de Mandioca Pronta", unit: "unidades", ratio: 1, carbs: 11.5, prot: 0.3, fat: 1.8 },
            { id: "pure_batata", name: "Purê de Batata", unit: "unidades", ratio: 1, carbs: 4.5, prot: 0.6, fat: 1.2 },
            { id: "polenta", name: "Polenta Cozida", unit: "gramas", ratio: 100, carbs: 16.0, prot: 1.8, fat: 0.4 },

            // PÃES E MASSAS (unidades ou fatias)
            { id: "pao_frances", name: "Pão Francês", unit: "unidades", ratio: 1, carbs: 28.0, prot: 4.5, fat: 1.5 },
            { id: "pao_frances_sem_miolo", name: "Pão Francês sem Miolo", unit: "unidades", ratio: 1, carbs: 20.0, prot: 3.2, fat: 1.0 },
            { id: "pao_de_forma", name: "Pão de Forma Branco", unit: "unidades", ratio: 1, carbs: 13.0, prot: 2.0, fat: 0.8 },
            { id: "pao_integral", name: "Pão Integral", unit: "unidades", ratio: 1, carbs: 12.0, prot: 2.2, fat: 0.9 },
            { id: "pao_hamburguer", name: "Pão de Hambúrguer", unit: "unidades", ratio: 1, carbs: 28.0, prot: 4.0, fat: 1.5 },
            { id: "pao_hotdog", name: "Pão de Hot Dog", unit: "unidades", ratio: 1, carbs: 28.0, prot: 4.0, fat: 1.5 },
            { id: "pao_sirio", name: "Pão Sírio Integral/Pita", unit: "unidades", ratio: 1, carbs: 22.0, prot: 3.5, fat: 0.5 },
            { id: "pao_italiano", name: "Pão Italiano", unit: "unidades", ratio: 1, carbs: 22.5, prot: 3.8, fat: 0.4 },
            { id: "brioche", name: "Brioche", unit: "unidades", ratio: 1, carbs: 24.0, prot: 5.0, fat: 6.5 },
            { id: "croissant", name: "Croissant Simples", unit: "unidades", ratio: 1, carbs: 27.0, prot: 5.0, fat: 13.0 },
            { id: "tapioca", name: "Tapioca Pronta", unit: "gramas", ratio: 50, carbs: 27.0, prot: 0.1, fat: 0.0 },
            { id: "crepioca", name: "Crepioca Simples", unit: "unidades", ratio: 1, carbs: 11.0, prot: 7.0, fat: 5.0 },
            { id: "wrap_tradicional", name: "Wrap/Rap10 Tradicional", unit: "unidades", ratio: 1, carbs: 22.0, prot: 3.6, fat: 2.8 },
            { id: "wrap_integral", name: "Wrap/Rap10 Integral", unit: "unidades", ratio: 1, carbs: 19.0, prot: 3.8, fat: 2.5 },
            { id: "biscoito_cracker", name: "Biscoito Cream Cracker", unit: "unidades", ratio: 1, carbs: 17.0, prot: 2.2, fat: 3.0 },
            { id: "biscoito_polvilho", name: "Biscoito de Polvilho", unit: "gramas", ratio: 50, carbs: 37.5, prot: 1.0, fat: 6.0 },
            { id: "biscoito_maisena", name: "Biscoito Maisena/Maria", unit: "unidades", ratio: 1, carbs: 11.2, prot: 1.1, fat: 2.0 },
            { id: "torrada", name: "Torrada Tradicional", unit: "unidades", ratio: 1, carbs: 21.0, prot: 3.6, fat: 1.5 },
            { id: "torrada_integral", name: "Torrada Integral", unit: "unidades", ratio: 1, carbs: 20.0, prot: 3.8, fat: 1.2 },

            // SALGADOS E LANCHES DE PADARIA (unidades)
            { id: "pao_de_queijo", name: "Pão de Queijo", unit: "unidades", ratio: 1, carbs: 8.0, prot: 2.5, fat: 5.0 },
            { id: "coxinha", name: "Coxinha de Frango Frita", unit: "unidades", ratio: 1, carbs: 35.0, prot: 12.0, fat: 15.0 },
            { id: "coxinha_requeijao", name: "Coxinha com Requeijão Frita", unit: "unidades", ratio: 1, carbs: 38.0, prot: 14.0, fat: 19.0 },
            { id: "pastel_carne", name: "Pastel de Carne Frito", unit: "unidades", ratio: 1, carbs: 30.0, prot: 10.0, fat: 18.0 },
            { id: "pastel_queijo", name: "Pastel de Queijo Frito", unit: "unidades", ratio: 1, carbs: 28.0, prot: 12.0, fat: 20.0 },
            { id: "esfiha_carne", name: "Esfiha Assada de Carne", unit: "unidades", ratio: 1, carbs: 28.0, prot: 9.0, fat: 8.0 },
            { id: "esfiha_frango", name: "Esfiha Assada de Frango/Requeijão", unit: "unidades", ratio: 1, carbs: 29.0, prot: 11.0, fat: 9.0 },
            { id: "kibe_frito", name: "Kibe Frito", unit: "unidades", ratio: 1, carbs: 22.0, prot: 10.0, fat: 12.0 },
            { id: "kibe_assado", name: "Kibe Assado", unit: "unidades", ratio: 1, carbs: 20.0, prot: 14.0, fat: 6.0 },
            { id: "empada_frango", name: "Empada de Frango", unit: "unidades", ratio: 1, carbs: 24.0, prot: 6.0, fat: 14.0 },
            { id: "empada_palmito", name: "Empada de Palmito", unit: "unidades", ratio: 1, carbs: 25.0, prot: 4.0, fat: 14.0 },
            { id: "quiche", name: "Quiche de Alho Poró/Queijo", unit: "gramas", ratio: 100, carbs: 20.0, prot: 8.0, fat: 22.0 },
            { id: "folhado", name: "Folhado Presunto e Queijo", unit: "unidades", ratio: 1, carbs: 29.0, prot: 8.0, fat: 22.0 },
            { id: "pao_batata_requeijao", name: "Pão de Batata Recheado", unit: "unidades", ratio: 1, carbs: 36.0, prot: 7.0, fat: 9.0 },
            { id: "chipa", name: "Chipa de Queijo", unit: "unidades", ratio: 1, carbs: 12.0, prot: 3.5, fat: 7.0 },

            // FRUTAS (unidades ou 100g)
            { id: "banana_prata", name: "Banana Prata", unit: "unidades", ratio: 1, carbs: 18.2, prot: 0.9, fat: 0.2 },
            { id: "banana_nanica", name: "Banana Nanica", unit: "unidades", ratio: 1, carbs: 21.6, prot: 1.1, fat: 0.1 },
            { id: "maca", name: "Maçã Vermelha/Verde", unit: "unidades", ratio: 1, carbs: 19.5, prot: 0.4, fat: 0.2 },
            { id: "morango", name: "Morango Fresco", unit: "gramas", ratio: 100, carbs: 6.8, prot: 0.8, fat: 0.3 },
            { id: "melancia", name: "Melancia", unit: "unidades", ratio: 1, carbs: 12.0, prot: 0.9, fat: 0.1 },
            { id: "abacate", name: "Abacate Fresco", unit: "gramas", ratio: 100, carbs: 6.0, prot: 2.0, fat: 15.0 },
            { id: "mamao_papaia", name: "Mamão Papaia", unit: "unidades", ratio: 1, carbs: 16.0, prot: 0.8, fat: 0.2 },
            { id: "mamao_formosa", name: "Mamão Formosa", unit: "unidades", ratio: 1, carbs: 17.4, prot: 0.7, fat: 0.1 },
            { id: "melao", name: "Melão Amarelo", unit: "unidades", ratio: 1, carbs: 7.5, prot: 0.7, fat: 0.0 },
            { id: "abacaxi", name: "Abacaxi Pérola", unit: "unidades", ratio: 1, carbs: 10.0, prot: 0.4, fat: 0.1 },
            { id: "manga_palmer", name: "Manga Palmer", unit: "unidades", ratio: 1, carbs: 22.0, prot: 1.2, fat: 0.4 },
            { id: "uva_italia", name: "Uva Itália/Rubi", unit: "unidades", ratio: 1, carbs: 14.0, prot: 0.5, fat: 0.2 },
            { id: "uva_niagara", name: "Uva Niágara/Rosada", unit: "unidades", ratio: 1, carbs: 12.0, prot: 0.5, fat: 0.3 },
            { id: "pera", name: "Pêra Willians/Portuguesa", unit: "unidades", ratio: 1, carbs: 18.0, prot: 0.4, fat: 0.2 },
            { id: "kiwi", name: "Kiwi", unit: "unidades", ratio: 1, carbs: 11.5, prot: 0.9, fat: 0.4 },
            { id: "pessego", name: "Pêssego Fresco", unit: "unidades", ratio: 1, carbs: 9.3, prot: 0.9, fat: 0.2 },
            { id: "laranja", name: "Laranja Pêra", unit: "unidades", ratio: 1, carbs: 15.0, prot: 1.2, fat: 0.1 },
            { id: "tangerina", name: "Tangerina/Mexerica", unit: "unidades", ratio: 1, carbs: 11.2, prot: 0.8, fat: 0.1 },
            { id: "limao", name: "Limão Taiti", unit: "unidades", ratio: 1, carbs: 5.5, prot: 0.4, fat: 0.1 },
            { id: "goiaba_vermelha", name: "Goiaba Vermelha", unit: "unidades", ratio: 1, carbs: 12.4, prot: 1.1, fat: 0.4 },
            { id: "ameixa", name: "Ameixa Vermelha Fresca", unit: "unidades", ratio: 1, carbs: 5.5, prot: 0.4, fat: 0.1 },
            { id: "cereja", name: "Cereja Fresca", unit: "unidades", ratio: 1, carbs: 11.2, prot: 0.7, fat: 0.2 },
            { id: "maracuja_polpa", name: "Maracujá Polpa", unit: "unidades", ratio: 1, carbs: 3.6, prot: 0.6, fat: 0.6 },
            { id: "salada_frutas", name: "Salada de Frutas Simples", unit: "unidades", ratio: 1, carbs: 20.0, prot: 1.2, fat: 0.3 },

            // VEGETAIS E LEGUMES COZIDOS (100g ou un)
            { id: "brocolis", name: "Brócolis Cozido", unit: "gramas", ratio: 100, carbs: 4.4, prot: 2.1, fat: 0.5 },
            { id: "cenoura_cozida", name: "Cenoura Cozida", unit: "gramas", ratio: 100, carbs: 6.7, prot: 0.8, fat: 0.2 },
            { id: "cenoura_crua", name: "Cenoura Crua Ralada", unit: "gramas", ratio: 100, carbs: 7.7, prot: 1.3, fat: 0.2 },
            { id: "abobora_cabotia", name: "Abóbora Cabotiá Cozida", unit: "gramas", ratio: 100, carbs: 10.8, prot: 1.4, fat: 0.7 },
            { id: "abobora_moranga", name: "Abóbora Moranga Cozida", unit: "gramas", ratio: 100, carbs: 6.0, prot: 1.0, fat: 0.1 },
            { id: "beterraba", name: "Beterraba Cozida", unit: "gramas", ratio: 100, carbs: 9.9, prot: 1.3, fat: 0.1 },
            { id: "abobrinha", name: "Abobrinha Italiana Cozida", unit: "gramas", ratio: 100, carbs: 3.0, prot: 1.1, fat: 0.2 },
            { id: "berinjela", name: "Berinjela Grelhada", unit: "gramas", ratio: 100, carbs: 5.7, prot: 0.8, fat: 0.1 },
            { id: "chuchu", name: "Chuchu Cozido", unit: "gramas", ratio: 100, carbs: 4.6, prot: 0.4, fat: 0.1 },
            { id: "vagem", name: "Vagem Cozida", unit: "gramas", ratio: 100, carbs: 5.3, prot: 1.8, fat: 0.2 },
            { id: "tomate", name: "Tomate Salada Cru", unit: "unidades", ratio: 1, carbs: 2.5, prot: 0.9, fat: 0.2 },
            { id: "palmito", name: "Palmito em Conserva", unit: "gramas", ratio: 100, carbs: 4.3, prot: 1.8, fat: 0.5 },
            { id: "cogumelo_paris", name: "Cogumelo Paris Refogado", unit: "gramas", ratio: 100, carbs: 4.5, prot: 2.9, fat: 2.2 },
            { id: "pepino", name: "Pepino Cru com Casca", unit: "gramas", ratio: 100, carbs: 2.0, prot: 0.7, fat: 0.1 },
            { id: "couve_refogada", name: "Couve Manteiga Refogada", unit: "unidades", ratio: 1, carbs: 3.5, prot: 0.7, fat: 1.5 },

            // PROTEÍNAS, OVOS E FRIOS (100g ou un)
            { id: "frango_grelhado", name: "Peito de Frango Grelhado", unit: "gramas", ratio: 100, carbs: 0.0, prot: 32.0, fat: 2.5 },
            { id: "sobrecoxa_frango_assada", name: "Sobrecoxa Frango Assada", unit: "gramas", ratio: 100, carbs: 0.0, prot: 24.0, fat: 9.0 },
            { id: "carne_grelhada", name: "Carne Bovina Grelhada / Mignon", unit: "gramas", ratio: 100, carbs: 0.0, prot: 32.8, fat: 5.6 },
            { id: "carne_moida", name: "Carne Bovina Moída / Patinho", unit: "gramas", ratio: 100, carbs: 0.0, prot: 28.0, fat: 7.0 },
            { id: "carne_cozida", name: "Carne Bovina Cozida / Acém", unit: "gramas", ratio: 100, carbs: 0.0, prot: 26.5, fat: 10.9 },
            { id: "lombo_porco", name: "Lombo Suíno Grelhado", unit: "gramas", ratio: 100, carbs: 0.0, prot: 31.0, fat: 6.8 },
            { id: "costelinha_porco", name: "Costelinha de Porco Assada", unit: "gramas", ratio: 100, carbs: 0.0, prot: 24.0, fat: 20.0 },
            { id: "peixe_grelhado", name: "Peixe Grelhado / Tilápia", unit: "gramas", ratio: 100, carbs: 0.0, prot: 26.0, fat: 2.0 },
            { id: "salmao", name: "Salmão Grelhado / Assado", unit: "gramas", ratio: 100, carbs: 0.0, prot: 24.0, fat: 12.0 },
            { id: "atum_oleo", name: "Atum em Lata em Óleo", unit: "unidades", ratio: 1, carbs: 0.0, prot: 31.5, fat: 8.5 },
            { id: "atum_agua", name: "Atum em Lata em Água", unit: "unidades", ratio: 1, carbs: 0.0, prot: 31.0, fat: 1.0 },
            { id: "sardinha_lata", name: "Sardinha em Lata com Molho", unit: "unidades", ratio: 1, carbs: 1.2, prot: 20.0, fat: 13.0 },
            { id: "ovo_cozido", name: "Ovo de Galinha Cozido", unit: "unidades", ratio: 1, carbs: 0.3, prot: 6.3, fat: 4.8 },
            { id: "ovo_frito", name: "Ovo de Galinha Frito", unit: "unidades", ratio: 1, carbs: 0.3, prot: 6.3, fat: 9.0 },
            { id: "ovo_mexido", name: "Ovo Mexido Simples", unit: "unidades", ratio: 1, carbs: 0.8, prot: 12.0, fat: 13.0 },
            { id: "omelete", name: "Omelete Simples", unit: "unidades", ratio: 1, carbs: 1.2, prot: 18.0, fat: 19.0 },
            { id: "presunto", name: "Presunto Cozido", unit: "unidades", ratio: 1, carbs: 0.2, prot: 2.5, fat: 0.6 },
            { id: "peito_peru", name: "Peito de Peru", unit: "unidades", ratio: 1, carbs: 0.3, prot: 3.0, fat: 0.3 },
            { id: "bacon", name: "Bacon Frito", unit: "unidades", ratio: 1, carbs: 0.1, prot: 3.5, fat: 4.2 },
            { id: "salame", name: "Salame Italiano", unit: "unidades", ratio: 1, carbs: 0.2, prot: 4.2, fat: 7.2 },
            { id: "calabresa", name: "Linguiça Calabresa Frita", unit: "gramas", ratio: 100, carbs: 1.5, prot: 18.0, fat: 28.0 },
            { id: "linguica_frango", name: "Linguiça de Frango Grelhada", unit: "unidades", ratio: 1, carbs: 0.5, prot: 11.0, fat: 12.0 },
            { id: "tofu", name: "Tofu Grelhado", unit: "gramas", ratio: 100, carbs: 2.0, prot: 8.0, fat: 4.8 },
            { id: "whey_isolado", name: "Whey Protein Isolado", unit: "unidades", ratio: 1, carbs: 1.5, prot: 24.0, fat: 1.0 },
            { id: "whey_concentrado", name: "Whey Protein Concentrado", unit: "unidades", ratio: 1, carbs: 3.5, prot: 23.0, fat: 2.0 },

            // LATICÍNIOS, GORDURAS E SUBSTITUTOS (copo, fatia ou colher)
            { id: "leite_integral", name: "Leite Integral", unit: "ml", ratio: 200, carbs: 9.4, prot: 6.4, fat: 6.7 },
            { id: "leite_desnatado", name: "Leite Desnatado", unit: "ml", ratio: 200, carbs: 10.0, prot: 6.4, fat: 0.2 },
            { id: "leite_semidesnatado", name: "Leite Semi-desnatado", unit: "ml", ratio: 200, carbs: 9.6, prot: 6.4, fat: 2.5 },
            { id: "leite_amendoas", name: "Leite de Amêndoas", unit: "ml", ratio: 200, carbs: 1.5, prot: 1.0, fat: 2.5 },
            { id: "leite_aveia", name: "Leite de Aveia", unit: "ml", ratio: 200, carbs: 16.0, prot: 2.0, fat: 3.0 },
            { id: "leite_coco", name: "Leite de Coco", unit: "unidades", ratio: 1, carbs: 0.8, prot: 0.3, fat: 3.0 },
            { id: "leite_soja", name: "Leite de Soja", unit: "ml", ratio: 200, carbs: 8.0, prot: 5.0, fat: 3.6 },
            { id: "iogurte", name: "Iogurte Natural Integral", unit: "unidades", ratio: 1, carbs: 6.2, prot: 6.8, fat: 6.0 },
            { id: "iogurte_grego", name: "Iogurte Grego Natural", unit: "unidades", ratio: 1, carbs: 4.5, prot: 7.0, fat: 5.0 },
            { id: "iogurte_desnatado", name: "Iogurte Natural Desnatado", unit: "unidades", ratio: 1, carbs: 8.0, prot: 7.0, fat: 0.2 },
            { id: "queijo_mussarela", name: "Queijo Mussarela", unit: "unidades", ratio: 1, carbs: 0.9, prot: 6.8, fat: 7.5 },
            { id: "queijo_prato", name: "Queijo Prato", unit: "unidades", ratio: 1, carbs: 0.6, prot: 6.8, fat: 8.2 },
            { id: "queijo_cottage", name: "Queijo Cottage", unit: "unidades", ratio: 1, carbs: 1.5, prot: 6.0, fat: 2.2 },
            { id: "creme_ricota", name: "Creme de Ricota", unit: "unidades", ratio: 1, carbs: 1.0, prot: 3.0, fat: 4.0 },
            { id: "queijo_minas", name: "Queijo Minas Frescal", unit: "unidades", ratio: 1, carbs: 1.6, prot: 8.0, fat: 9.0 },
            { id: "queijo_coalho", name: "Queijo Coalho Grelhado", unit: "unidades", ratio: 1, carbs: 1.2, prot: 14.0, fat: 16.0 },
            { id: "queijo_parmesao", name: "Queijo Parmesão Ralado", unit: "unidades", ratio: 1, carbs: 0.3, prot: 3.8, fat: 3.0 },
            { id: "requeijao", name: "Requeijão Cremoso", unit: "unidades", ratio: 1, carbs: 0.6, prot: 2.0, fat: 5.0 },
            { id: "cream_cheese", name: "Cream Cheese", unit: "unidades", ratio: 1, carbs: 1.5, prot: 1.8, fat: 10.0 },
            { id: "manteiga", name: "Manteiga com Sal", unit: "unidades", ratio: 1, carbs: 0.0, prot: 0.1, fat: 8.3 },
            { id: "margarina", name: "Margarina Cremosa", unit: "unidades", ratio: 1, carbs: 0.0, prot: 0.0, fat: 7.5 },

            // LEGUMINOSAS E OLEAGINOSAS (100g ou colher)
            { id: "feijao_carioca", name: "Feijão Carioca Cozido", unit: "gramas", ratio: 100, carbs: 14.0, prot: 4.8, fat: 0.5 },
            { id: "feijao_preto", name: "Feijão Preto Cozido", unit: "gramas", ratio: 100, carbs: 14.0, prot: 4.5, fat: 0.5 },
            { id: "feijao_vermelho", name: "Feijão Vermelho Cozido", unit: "gramas", ratio: 100, carbs: 15.0, prot: 5.2, fat: 0.4 },
            { id: "grao_de_bico", name: "Grão de Bico Cozido", unit: "gramas", ratio: 100, carbs: 27.0, prot: 8.8, fat: 2.6 },
            { id: "lentilha", name: "Lentilha Cozida", unit: "gramas", ratio: 100, carbs: 20.0, prot: 9.0, fat: 0.4 },
            { id: "ervilha_lata", name: "Ervilha em Lata Escorrida", unit: "gramas", ratio: 100, carbs: 13.0, prot: 5.0, fat: 0.5 },
            { id: "amendoim", name: "Amendoim Torrado Salgado", unit: "gramas", ratio: 100, carbs: 16.0, prot: 26.0, fat: 49.0 },
            { id: "castanha_caju", name: "Castanha de Caju", unit: "gramas", ratio: 100, carbs: 30.0, prot: 18.0, fat: 43.0 },
            { id: "castanha_para", name: "Castanha do Pará", unit: "unidades", ratio: 1, carbs: 1.8, prot: 2.1, fat: 10.0 },
            { id: "nozes", name: "Nozes Chilenas", unit: "unidades", ratio: 1, carbs: 3.5, prot: 3.8, fat: 16.2 },
            { id: "amendoas", name: "Amêndoas Sem Casca", unit: "unidades", ratio: 1, carbs: 3.2, prot: 3.2, fat: 7.5 },
            { id: "pasta_amendoim", name: "Pasta de Amendoim", unit: "unidades", ratio: 1, carbs: 3.0, prot: 4.0, fat: 8.0 },
            { id: "semente_chia", name: "Semente de Chia", unit: "unidades", ratio: 1, carbs: 6.3, prot: 2.5, fat: 4.6 },
            { id: "semente_linhaca", name: "Semente de Linhaça", unit: "unidades", ratio: 1, carbs: 4.5, prot: 3.0, fat: 6.0 },
            { id: "gergelim", name: "Semente de Gergelim", unit: "unidades", ratio: 1, carbs: 3.5, prot: 2.7, fat: 7.5 },

            // FAST FOOD, PRATOS PRONTOS E INTERNACIONAIS (unidades ou 100g)
            { id: "cheeseburger", name: "Cheeseburger Clássico", unit: "unidades", ratio: 1, carbs: 32.0, prot: 16.0, fat: 14.0 },
            { id: "big_mac", name: "Big Mac McDonald's", unit: "unidades", ratio: 1, carbs: 45.0, prot: 26.0, fat: 30.0 },
            { id: "whopper", name: "Whopper Burger King", unit: "unidades", ratio: 1, carbs: 49.0, prot: 32.0, fat: 38.0 },
            { id: "batata_frita", name: "Batata Frita Fast Food", unit: "gramas", ratio: 100, carbs: 38.0, prot: 4.0, fat: 17.0 },
            { id: "nuggets", name: "Nuggets de Frango", unit: "unidades", ratio: 1, carbs: 18.0, prot: 15.0, fat: 16.0 },
            { id: "onion_rings", name: "Cebola Frita Empanada", unit: "unidades", ratio: 1, carbs: 24.0, prot: 2.5, fat: 12.0 },
            { id: "pizza_mussarela", name: "Pizza de Mussarela", unit: "gramas", ratio: 100, carbs: 26.0, prot: 12.0, fat: 11.0 },
            { id: "pizza_calabresa", name: "Pizza de Calabresa", unit: "gramas", ratio: 100, carbs: 26.0, prot: 13.0, fat: 14.0 },
            { id: "pizza_pepperoni", name: "Pizza de Pepperoni", unit: "gramas", ratio: 100, carbs: 25.0, prot: 13.5, fat: 13.0 },
            { id: "pizza_margherita", name: "Pizza Margherita", unit: "gramas", ratio: 100, carbs: 23.0, prot: 10.5, fat: 10.0 },
            { id: "sushi_nigiri", name: "Sushi Nigiri Salmão", unit: "gramas", ratio: 100, carbs: 24.0, prot: 6.0, fat: 2.0 },
            { id: "sushi_uramaki", name: "Sushi Califórnia Uramaki", unit: "gramas", ratio: 120, carbs: 28.0, prot: 4.5, fat: 1.5 },
            { id: "sushi_hotroll", name: "Sushi Hot Roll Frito", unit: "gramas", ratio: 120, carbs: 35.0, prot: 8.0, fat: 12.0 },
            { id: "temaki", name: "Temaki Salmão com Cream Cheese", unit: "unidades", ratio: 1, carbs: 28.0, prot: 15.0, fat: 9.0 },
            { id: "yakissoba", name: "Yakissoba Misto Carne/Frango", unit: "gramas", ratio: 100, carbs: 14.0, prot: 6.0, fat: 3.5 },
            { id: "lasanha", name: "Lasanha de Carne Bolonhesa", unit: "gramas", ratio: 100, carbs: 12.5, prot: 9.0, fat: 7.5 },
            { id: "estrogonofe_carne", name: "Estrogonofe de Carne", unit: "gramas", ratio: 100, carbs: 4.2, prot: 14.8, fat: 16.5 },
            { id: "estrogonofe_frango", name: "Estrogonofe de Frango", unit: "gramas", ratio: 100, carbs: 4.5, prot: 16.0, fat: 14.0 },
            { id: "taco", name: "Taco Mexicano de Carne", unit: "unidades", ratio: 1, carbs: 15.0, prot: 10.0, fat: 9.0 },
            { id: "burrito", name: "Burrito Carne e Feijão", unit: "unidades", ratio: 1, carbs: 44.0, prot: 18.0, fat: 16.0 },
            { id: "guacamole", name: "Guacamole", unit: "unidades", ratio: 1, carbs: 3.2, prot: 0.8, fat: 6.2 },
            { id: "hot_wings", name: "Asinha de Frango Frita", unit: "unidades", ratio: 1, carbs: 6.0, prot: 22.0, fat: 18.0 },
            { id: "waffle", name: "Waffle Tradicional", unit: "unidades", ratio: 1, carbs: 28.0, prot: 5.0, fat: 8.0 },
            { id: "donut", name: "Donut com Cobertura", unit: "unidades", ratio: 1, carbs: 31.0, prot: 3.0, fat: 14.0 },

            // DOCES, SOBREMESAS E LANCHES DOCES (gramas ou un)
            { id: "chocolate_ao_leite", name: "Chocolate ao Leite", unit: "gramas", ratio: 25, carbs: 14.0, prot: 1.6, fat: 8.5 },
            { id: "chocolate_amargo", name: "Chocolate 70% Cacau", unit: "gramas", ratio: 25, carbs: 9.0, prot: 2.0, fat: 10.5 },
            { id: "chocolate_branco", name: "Chocolate Branco", unit: "gramas", ratio: 25, carbs: 14.5, prot: 1.5, fat: 8.8 },
            { id: "brigadeiro", name: "Brigadeiro Gourmet", unit: "unidades", ratio: 1, carbs: 12.5, prot: 1.2, fat: 3.5 },
            { id: "doce_leite", name: "Doce de Leite Cremoso", unit: "unidades", ratio: 1, carbs: 11.0, prot: 1.2, fat: 1.5 },
            { id: "pudim", name: "Pudim de Leite Condensado", unit: "gramas", ratio: 100, carbs: 32.0, prot: 4.8, fat: 6.5 },
            { id: "bolo_simples", name: "Bolo de Trigo Caseiro", unit: "unidades", ratio: 1, carbs: 30.0, prot: 3.5, fat: 5.0 },
            { id: "bolo_chocolate", name: "Bolo Chocolate com Calda", unit: "unidades", ratio: 1, carbs: 42.0, prot: 4.2, fat: 12.0 },
            { id: "sorvete_massa", name: "Sorvete Massa Creme/Choc", unit: "unidades", ratio: 1, carbs: 15.0, prot: 2.0, fat: 6.0 },
            { id: "gelatina", name: "Gelatina Sabores Comum", unit: "gramas", ratio: 100, carbs: 14.0, prot: 1.8, fat: 0.0 },
            { id: "gelatina_zero", name: "Gelatina Sabores Zero Açúcar", unit: "gramas", ratio: 100, carbs: 0.0, prot: 1.4, fat: 0.0 },
            { id: "acai", name: "Açaí na Tigela com Xarope", unit: "gramas", ratio: 100, carbs: 21.0, prot: 0.8, fat: 3.2 },
            { id: "pacoca", name: "Paçoca de Amendoim Rolha", unit: "unidades", ratio: 1, carbs: 12.2, prot: 3.5, fat: 5.8 },
            { id: "geleia", name: "Geleia de Frutas com Açúcar", unit: "unidades", ratio: 1, carbs: 13.0, prot: 0.1, fat: 0.0 },
            { id: "geleia_diet", name: "Geleia de Frutas Diet", unit: "unidades", ratio: 1, carbs: 3.5, prot: 0.1, fat: 0.0 },
            { id: "salada_frutas_leite_cond", name: "Salada Frutas c/ Leite Cond", unit: "unidades", ratio: 1, carbs: 32.0, prot: 2.0, fat: 3.0 },

            // BEBIDAS (copos/ml ou latas)
            { id: "suco_laranja", name: "Suco de Laranja Natural", unit: "ml", ratio: 200, carbs: 23.0, prot: 1.4, fat: 0.2 },
            { id: "suco_uva", name: "Suco de Uva Integral", unit: "ml", ratio: 200, carbs: 28.0, prot: 0.5, fat: 0.0 },
            { id: "suco_limao_sem_acucar", name: "Suco de Limão sem Açúcar", unit: "ml", ratio: 200, carbs: 1.8, prot: 0.1, fat: 0.0 },
            { id: "agua_coco", name: "Água de Coco Natural", unit: "ml", ratio: 200, carbs: 10.0, prot: 0.4, fat: 0.0 },
            { id: "cerveja", name: "Cerveja Comum Lager", unit: "ml", ratio: 350, carbs: 12.0, prot: 1.5, fat: 0.0 },
            { id: "cerveja_puro_malte", name: "Cerveja Puro Malte", unit: "ml", ratio: 350, carbs: 10.5, prot: 1.6, fat: 0.0 },
            { id: "cerveja_sem_alcool", name: "Cerveja Sem Álcool", unit: "ml", ratio: 350, carbs: 18.0, prot: 1.2, fat: 0.0 },
            { id: "vinho_seco", name: "Vinho Tinto Seco", unit: "ml", ratio: 150, carbs: 3.8, prot: 0.0, fat: 0.0 },
            { id: "vinho_suave", name: "Vinho Tinto Suave", unit: "ml", ratio: 150, carbs: 12.5, prot: 0.0, fat: 0.0 },
            { id: "espumante_brut", name: "Espumante Brut", unit: "ml", ratio: 120, carbs: 1.5, prot: 0.0, fat: 0.0 },
            { id: "energetico", name: "Energético Red Bull Comum", unit: "ml", ratio: 250, carbs: 27.0, prot: 0.0, fat: 0.0 },
            { id: "energetico_zero", name: "Energético Zero Açúcar", unit: "ml", ratio: 250, carbs: 0.0, prot: 0.0, fat: 0.0 },
            { id: "refrigerante", name: "Refrigerante Comum", unit: "ml", ratio: 350, carbs: 37.0, prot: 0.0, fat: 0.0 },
            { id: "refrigerante_zero", name: "Refrigerante Zero Açúcar", unit: "ml", ratio: 350, carbs: 0.0, prot: 0.0, fat: 0.0 },
            { id: "cha_mate_doce", name: "Chá Mate Batido com Açúcar", unit: "ml", ratio: 300, carbs: 24.0, prot: 0.0, fat: 0.0 },
            { id: "cha_sem_acucar", name: "Chá Preto/Verde sem Açúcar", unit: "ml", ratio: 200, carbs: 0.0, prot: 0.0, fat: 0.0 },

            // MOLHOS E CONDIMENTOS (colher de sopa)
            { id: "ketchup", name: "Ketchup Tradicional", unit: "unidades", ratio: 1, carbs: 4.0, prot: 0.2, fat: 0.0 },
            { id: "mostarda", name: "Mostarda Amarela", unit: "unidades", ratio: 1, carbs: 0.8, prot: 0.6, fat: 0.5 },
            { id: "maionese", name: "Maionese Tradicional", unit: "unidades", ratio: 1, carbs: 0.9, prot: 0.2, fat: 5.7 },
            { id: "azeite", name: "Azeite de Oliva Extra Virgem", unit: "ml", ratio: 13, carbs: 0.0, prot: 0.0, fat: 12.0 },
            { id: "molho_tomate", name: "Molho de Tomate Refogado", unit: "gramas", ratio: 30, carbs: 2.1, prot: 0.4, fat: 0.3 },
            { id: "shoyu", name: "Molho Shoyu Tradicional", unit: "ml", ratio: 15, carbs: 1.2, prot: 1.3, fat: 0.0 },
            { id: "mel", name: "Mel de Abelha", unit: "unidades", ratio: 1, carbs: 12.5, prot: 0.1, fat: 0.0 },
            { id: "melado", name: "Melado de Cana", unit: "unidades", ratio: 1, carbs: 11.5, prot: 0.0, fat: 0.0 }
        ];

const getMinutesAgo = (date: number) => {
  if (!date) return '--';
  const diff = Math.floor((Date.now() - date) / 60000);
  if (diff < 0) return 'agora';
  if (diff < 60) return `${diff}m atrás`;
  return `${Math.floor(diff / 60)}h atrás`;
};

export default function ReportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark, fontScale } = useSettings();
  const { id, name, url } = useLocalSearchParams<{ id: string; name: string; url: string }>();

  // Navegação de Abas
  const [activeTab, setActiveTab] = useState<'report' | 'assistant' | 'careportal'>('report');
  const [isPro, setIsPro] = useState(false);
  const [foodSearch, setFoodSearch] = useState('');
  const [selectedFood, setSelectedFood] = useState<any | null>(null);
  const [foodQty, setFoodQty] = useState('100');


  // Período selecionado (em dias)
  const [selectedDays, setSelectedDays] = useState<number>(3); // 3 dias por padrão

  // Estados dos Dados
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [entries, setEntries] = useState<GlucoseEntry[]>([]);
  const [properties, setProperties] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [deviceStatus, setDeviceStatus] = useState<any[]>([]);

  // Estados de Registro do Careportal
  const [isAddTreatmentModalOpen, setIsAddTreatmentModalOpen] = useState(false);
  const [submittingTreatment, setSubmittingTreatment] = useState(false);
  const [tType, setTType] = useState<'Meal Bolus' | 'Correction Bolus' | 'Snack' | 'Note'>('Meal Bolus');
  const [tCarbs, setTCarbs] = useState('');
  const [tInsulin, setTInsulin] = useState('');
  const [tGlucose, setTGlucose] = useState('');
  const [tNotes, setTNotes] = useState('');

  // Estados de Prato e Sugestão de Bolus (Careportal)
  const [mealFoods, setMealFoods] = useState<MealFood[]>([]);
  const [mealTotals, setMealTotals] = useState({ carbs: 0, prot: 0, fat: 0, ugp: 0 });
  const [cGlucose, setCGlucose] = useState('');
  const [cTarget, setCTarget] = useState('100');
  const [cCalculatedBolus, setCCalculatedBolus] = useState<number | null>(null);
  const [cCalculatedCarbInsulin, setCCalculatedCarbInsulin] = useState<number>(0);
  const [cCalculatedCorrectInsulin, setCCalculatedCorrectInsulin] = useState<number>(0);
  const [cNotes, setCNotes] = useState('');

  // Estados de Métricas
  const [avgGlucose, setAvgGlucose] = useState(0);
  const [sdGlucose, setSdGlucose] = useState(0); // Desvio Padrão
  const [ea1c, setEa1c] = useState(0); // eA1C estimada
  const [tirPercentages, setTirPercentages] = useState({
    veryHigh: 0,
    high: 0,
    inRange: 0,
    low: 0,
    veryLow: 0
  });

  // Matriz de Heatmap: 7 dias (Dom a Sab) x 24 horas (0 a 23)
  const [heatmapMatrix, setHeatmapMatrix] = useState<number[][]>(
    Array(7).fill(null).map(() => Array(24).fill(0))
  );
  const [heatmapCounts, setHeatmapCounts] = useState<number[][]>(
    Array(7).fill(null).map(() => Array(24).fill(0))
  );

  // Novos Gráficos: Distribuição Horária e Diária
  const [hourlyTir, setHourlyTir] = useState<number[]>(Array(24).fill(0));
  const [dailyStats, setDailyStats] = useState<{ dateStr: string; avg: number; tir: number; sd: number; }[]>([]);

  // Período personalizado
  const [isCustomDaysModalOpen, setIsCustomDaysModalOpen] = useState(false);
  const [customDaysInput, setCustomDaysInput] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);

  // Carregar dados através do proxy seguro do backend Next.js na Vercel
  const fetchReportData = async (days = selectedDays) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }
      setIsPro(session?.user?.user_metadata?.role === 'pro');

      // --- Busca paginada de entries (em chunks de 10 dias) ---
      // Aumentamos o tamanho do chunk para 10 dias para reduzir o número de requisições HTTP,
      // minimizando rate limiting e concorrência que causavam timeouts silenciosos em períodos longos (30 dias).
      // Cada chunk busca até 3000 registros, o que garante a cobertura de 10 dias (10 * 288 = 2880 leituras).
      const endTimestamp = Date.now();
      const startTimestamp = endTimestamp - (days * 24 * 60 * 60 * 1000);
      
      // Configurar chunks dinâmicos dependendo da quantidade de dias para otimizar desempenho e evitar cortes
      // por limite de count em uploaders de alta frequência (como 1 leitura/minuto)
      let CHUNK_MS = 5 * 24 * 60 * 60 * 1000; // 5 dias por chunk por padrão
      let chunkCountLimit = 8000; // Cobre com folga 5 dias a 1 leitura/minuto (5 * 1440 = 7200)
      
      if (days > 30) {
        CHUNK_MS = 10 * 24 * 60 * 60 * 1000; // 10 dias por chunk para períodos longos (90 dias)
        chunkCountLimit = 16000; // Cobre com folga 10 dias a 1 leitura/minuto (10 * 1440 = 14400)
      }
      
      const BATCH_SIZE = 3; // Requisições paralelas por lote

      const chunks: { start: number; end: number }[] = [];
      let cs = startTimestamp;
      while (cs < endTimestamp) {
        const ce = Math.min(cs + CHUNK_MS, endTimestamp);
        chunks.push({ start: cs, end: ce });
        cs = ce;
      }

      const headers = {
        'Authorization': `Bearer ${session.access_token}`,
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      };

      // Endpoints auxiliares (pequenos, sem necessidade de paginação)
      const propertiesUrl = `https://tndscout.vercel.app/api/patient/proxy?patientId=${id}&endpoint=api/v2/properties&t=${Date.now()}`;
      const profileUrl = `https://tndscout.vercel.app/api/patient/proxy?patientId=${id}&endpoint=api/v1/profile.json&t=${Date.now()}`;
      const treatmentsUrl = `https://tndscout.vercel.app/api/patient/proxy?patientId=${id}&endpoint=api/v1/treatments.json&count=40&t=${Date.now()}`;
      const deviceUrl = `https://tndscout.vercel.app/api/patient/proxy?patientId=${id}&endpoint=api/v1/devicestatus.json&count=5&t=${Date.now()}`;

      // Iniciar busca dos endpoints auxiliares em paralelo (não bloqueiam os entries)
      const auxPromise = Promise.all([
        fetch(propertiesUrl, { headers }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(profileUrl, { headers }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(treatmentsUrl, { headers }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(deviceUrl, { headers }).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);

      // Buscar entries em lotes paralelos de 3 chunks com filtro de data
      const allRawEntries: any[] = [];
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map(chunk => {
            const chunkUrl = `https://tndscout.vercel.app/api/patient/proxy?patientId=${id}&endpoint=api/v1/entries/sgv.json&find%5Bdate%5D%5B%24gte%5D=${chunk.start}&find%5Bdate%5D%5B%24lte%5D=${chunk.end}&count=${chunkCountLimit}&t=${Date.now()}`;
            return fetch(chunkUrl, { headers })
              .then(r => {
                if (!r.ok) {
                  console.log(`[Nightscout API] Erro no chunk [${new Date(chunk.start).toLocaleDateString()} - ${new Date(chunk.end).toLocaleDateString()}]: Status ${r.status}`);
                }
                return r.ok ? r.json() : [];
              })
              .catch((err) => {
                console.log(`[Nightscout API] Falha de rede/timeout no chunk:`, err);
                return [];
              });
          })
        );
        results.forEach(data => {
          if (Array.isArray(data)) {
            allRawEntries.push(...data);
          }
        });
      }

      // Deduplicar entries por timestamp (evita duplicatas nas bordas dos chunks)
      const uniqueMap = new Map<number, any>();
      allRawEntries.forEach(item => {
        if (item.date) {
          uniqueMap.set(Number(item.date), item);
        }
      });
      const resEntries = Array.from(uniqueMap.values());

      // Aguardar endpoints auxiliares
      const [resProps, resProfile, resTreatments, resDevice] = await auxPromise;

      if (resEntries.length === 0) {
        throw new Error('Nenhuma leitura glicêmica recente encontrada no Nightscout.');
      }

      // Processar glicemias
      const parsedEntries: GlucoseEntry[] = resEntries
        .filter((item: any) => item.sgv && item.date)
        .map((item: any) => ({
          sgv: Number(item.sgv),
          direction: item.direction || 'Flat',
          date: Number(item.date),
          dateString: item.dateString || ''
        }))
        .sort((a, b) => a.date - b.date);

      setEntries(parsedEntries);
      console.log("[LOG DE DADOS] Total de entradas salvas em entries:", parsedEntries.length);
      if (parsedEntries.length > 0) {
        console.log("[LOG DE DADOS] Primeira leitura (antiga):", new Date(parsedEntries[0].date).toLocaleDateString('pt-BR'));
        console.log("[LOG DE DADOS] Última leitura (recente):", new Date(parsedEntries[parsedEntries.length - 1].date).toLocaleDateString('pt-BR'));
      }
      computeMetrics(parsedEntries);
      computeHeatmap(parsedEntries, days);
      
      // Pré-preencher a glicose atual no assistente de bolus com a leitura mais recente do sensor
      if (parsedEntries.length > 0) {
        const latest = parsedEntries[parsedEntries.length - 1];
        setCGlucose(latest.sgv.toString());
      }

      // Salvar estados das outras abas
      setProperties(resProps);
      setProfile(resProfile);
      setTreatments(resTreatments || []);
      setDeviceStatus(resDevice || []);

    } catch (err: any) {
      console.log('Report: Erro de carregamento de glicemia:', err.message || err);
      setErrorMsg(err.message || 'Erro ao consultar dados clínicos.');
    } finally {
      setLoading(false);
    }
  };

  const computeMetrics = (data: GlucoseEntry[]) => {
    const totalCount = data.length;
    if (totalCount === 0) return;

    // A. Média
    const sum = data.reduce((acc, curr) => acc + curr.sgv, 0);
    const avg = sum / totalCount;
    setAvgGlucose(Math.round(avg));

    // B. Desvio Padrão (Variabilidade)
    const variance = data.reduce((acc, curr) => acc + Math.pow(curr.sgv - avg, 2), 0) / totalCount;
    const sd = Math.sqrt(variance);
    setSdGlucose(Math.round(sd));

    // C. eA1C (HbA1c estimada)
    const calculatedEa1c = (avg + 46.7) / 28.7;
    setEa1c(Number(calculatedEa1c.toFixed(2)));

    // D. Time in Range (TIR)
    let veryHigh = 0;
    let high = 0;
    let inRange = 0;
    let low = 0;
    let veryLow = 0;

    data.forEach(item => {
      if (item.sgv > 250) veryHigh++;
      else if (item.sgv > 180) high++;
      else if (item.sgv >= 70) inRange++;
      else if (item.sgv >= 54) low++;
      else veryLow++;
    });

    setTirPercentages({
      veryHigh: Math.round((veryHigh / totalCount) * 100),
      high: Math.round((high / totalCount) * 100),
      inRange: Math.round((inRange / totalCount) * 100),
      low: Math.round((low / totalCount) * 100),
      veryLow: Math.round((veryLow / totalCount) * 100)
    });
  };

  const computeHeatmap = (data: GlucoseEntry[], periodDays = selectedDays) => {
    const matrix = Array(7).fill(null).map(() => Array(24).fill(0));
    const counts = Array(7).fill(null).map(() => Array(24).fill(0));

    // For Hourly TIR
    const hourlyInRangeCount = Array(24).fill(0);
    const hourlyTotalCount = Array(24).fill(0);

    // For Daily Stats - agrupamos numericamente por início do dia local
    const dailyMap: Record<number, { sum: number, count: number, inRangeCount: number, sqSum: number }> = {};

    data.forEach(entry => {
      const date = new Date(entry.date);
      const day = date.getDay(); // 0-6
      const hour = date.getHours(); // 0-23

      // Heatmap
      matrix[day][hour] += entry.sgv;
      counts[day][hour] += 1;

      // Hourly TIR
      hourlyTotalCount[hour] += 1;
      if (entry.sgv >= 70 && entry.sgv <= 180) {
        hourlyInRangeCount[hour] += 1;
      }

      // Daily Stats - início do dia local para agrupamento e ordenação livre de bugs de fuso/localidade
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      if (!dailyMap[startOfDay]) {
        dailyMap[startOfDay] = { sum: 0, count: 0, inRangeCount: 0, sqSum: 0 };
      }
      dailyMap[startOfDay].sum += entry.sgv;
      dailyMap[startOfDay].count += 1;
      dailyMap[startOfDay].sqSum += Math.pow(entry.sgv, 2);
      if (entry.sgv >= 70 && entry.sgv <= 180) {
        dailyMap[startOfDay].inRangeCount += 1;
      }
    });

    // --- LOGS DE DEPURAÇÃO DO COMPUTEHEATMAP ---
    console.log("Total de glicemias processadas no computeHeatmap:", data.length);
    console.log("Distribuição de leituras por hora (0h a 23h):", hourlyTotalCount);
    const keys = Object.keys(dailyMap).map(Number).sort((a, b) => a - b);
    console.log("Quantidade de dias com leituras no dailyMap:", keys.length);
    if (keys.length > 0) {
      console.log("Menor data com dados no dailyMap:", new Date(keys[0]).toLocaleDateString('pt-BR'));
      console.log("Maior data com dados no dailyMap:", new Date(keys[keys.length - 1]).toLocaleDateString('pt-BR'));
    }

    const finalMatrix = matrix.map((row, dayIndex) =>
      row.map((val, hourIndex) => {
        const count = counts[dayIndex][hourIndex];
        return count > 0 ? Math.round(val / count) : 0;
      })
    );

    const hTir = hourlyTotalCount.map((total, idx) => {
      return total > 0 ? Math.round((hourlyInRangeCount[idx] / total) * 100) : 0;
    });

    // Gerar a lista completa de timestamps para todos os dias do período selecionado
    const dStats = [];
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    
    // Itera do dia mais antigo do período até hoje, preenchendo com null se não houver leituras
    for (let i = periodDays - 1; i >= 0; i--) {
      const timestamp = todayStart - (i * 24 * 60 * 60 * 1000);
      const d = dailyMap[timestamp];
      
      const dateObj = new Date(timestamp);
      const dateStr = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;
      
      if (d && d.count > 0) {
        const avg = d.sum / d.count;
        const tir = Math.round((d.inRangeCount / d.count) * 100);
        const variance = (d.sqSum / d.count) - Math.pow(avg, 2);
        const sd = Math.round(Math.sqrt(Math.max(0, variance)));
        
        dStats.push({
          dateStr,
          timestamp,
          avg: Math.round(avg),
          tir,
          sd,
          hasData: true
        });
      } else {
        dStats.push({
          dateStr,
          timestamp,
          avg: null,
          tir: null,
          sd: null,
          hasData: false
        });
      }
    }

    setHeatmapMatrix(finalMatrix);
    setHeatmapCounts(counts);
    setHourlyTir(hTir);
    setDailyStats(dStats);
  };

  // Algoritmo de Insights Clínicos Inteligentes
  const generateClinicalInsights = () => {
    const insights: { type: 'success' | 'warning' | 'danger' | 'info'; title: string; message: string; icon: string }[] = [];
    if (entries.length === 0) return insights;

    // 1. Análise do Tempo na Faixa (TIR)
    const tir = tirPercentages.inRange;
    if (tir >= 70) {
      insights.push({
        type: 'success',
        icon: '🎯',
        title: 'Excelente Tempo no Alvo',
        message: `Seu tempo na faixa alvo (TIR) está em ${tir}%, atendendo à meta internacional (>70%). Continue assim!`
      });
    } else if (tir >= 50) {
      insights.push({
        type: 'warning',
        icon: '📈',
        title: 'Tempo no Alvo Moderado',
        message: `Seu TIR está em ${tir}%. Ajustes finos no pré-bolus ou na contagem de carboidratos podem ajudar a aproximá-lo da meta ideal de 70%.`
      });
    } else {
      insights.push({
        type: 'danger',
        icon: '⚠️',
        title: 'Tempo no Alvo Baixo',
        message: `Seu TIR está em ${tir}%. A maior parte do tempo está fora da faixa segura. Recomenda-se analisar os padrões de hiper e hipoglicemia.`
      });
    }

    // 2. Análise de Hipoglicemia (Baixo e Muito Baixo)
    const totalHypo = tirPercentages.low + tirPercentages.veryLow;
    if (totalHypo > 4) {
      insights.push({
        type: 'danger',
        icon: '🚨',
        title: 'Frequência Alta de Hipoglicemias',
        message: `Você passou ${totalHypo}% do tempo em hipoglicemia. O limite recomendado é menor que 4%. Considere reduzir as doses basais ou revisar o fator de sensibilidade (ISF).`
      });
    }

    // 3. Variabilidade Glicêmica (SD / Média)
    if (avgGlucose > 0) {
      const cv = (sdGlucose / avgGlucose) * 100;
      if (cv > 36) {
        insights.push({
          type: 'warning',
          icon: '🔄',
          title: 'Alta Variabilidade Glicêmica',
          message: `Sua glicemia oscila rapidamente (Variação: ${cv.toFixed(0)}%). O ideal é mantê-la estável abaixo de 36%. Grandes oscilações aumentam o cansaço e o risco de hipoglicemia de rebote.`
        });
      } else {
        insights.push({
          type: 'success',
          icon: '⚖️',
          title: 'Excelente Estabilidade Glicêmica',
          message: `Sua variabilidade está controlada em ${cv.toFixed(0)}% (abaixo de 36%). Isso mostra que o controle está consistente e com poucas oscilações bruscas.`
        });
      }
    }

    // 4. Análise de Padrão Horário de Hiperglicemia
    const hourlyAverages = Array(24).fill(0);
    const hourlyCounts = Array(24).fill(0);
    entries.forEach(e => {
      const h = new Date(e.date).getHours();
      hourlyAverages[h] += e.sgv;
      hourlyCounts[h] += 1;
    });

    let peakHour = -1;
    let maxHourAvg = 0;
    for (let h = 0; h < 24; h++) {
      if (hourlyCounts[h] > 0) {
        const avg = hourlyAverages[h] / hourlyCounts[h];
        if (avg > maxHourAvg) {
          maxHourAvg = avg;
          peakHour = h;
        }
      }
    }

    if (maxHourAvg > 180 && peakHour !== -1) {
      let mealPeriod = 'durante o dia';
      if (peakHour >= 6 && peakHour <= 9) mealPeriod = 'no café da manhã';
      else if (peakHour >= 12 && peakHour <= 15) mealPeriod = 'no período do almoço';
      else if (peakHour >= 19 && peakHour <= 22) mealPeriod = 'no período do jantar';
      else if (peakHour >= 0 && peakHour <= 5) mealPeriod = 'durante a madrugada';

      insights.push({
        type: 'info',
        icon: '🍽️',
        title: `Pico recorrente ${mealPeriod}`,
        message: `Identificado maior nível glicêmico médio (${Math.round(maxHourAvg)} mg/dL) por volta das ${peakHour}h. Avalie o pré-bolus (tempo de espera) ou a relação insulina-carboidrato nesta refeição.`
      });
    }

    return insights;
  };

  // Exportar relatório completo como PDF e compartilhar via WhatsApp/Sistema
  const exportReportToPdf = async () => {
    setExportingPdf(true);
    try {
      // 1. Gráfico de Evolução (Line Chart) em SVG
      const lineSvgWidth = 700;
      const lineSvgHeight = 150;
      const lPadLeft = 40;
      const lPadRight = 20;
      const lPadTop = 10;
      const lPadBottom = 20;
      const lDrawWidth = lineSvgWidth - lPadLeft - lPadRight;
      const lDrawHeight = lineSvgHeight - lPadTop - lPadBottom;
      const lMinY = 40;
      const lMaxY = 400;

      let linePoints = '';
      if (entries.length > 0) {
        entries.forEach((e, idx) => {
          const x = lPadLeft + (idx / (entries.length - 1)) * lDrawWidth;
          const ratio = (e.sgv - lMinY) / (lMaxY - lMinY);
          const y = lPadTop + lDrawHeight * (1 - ratio);
          if (idx === 0) linePoints += `M ${x} ${y}`;
          else linePoints += ` L ${x} ${y}`;
        });
      }

      const ly180 = lPadTop + lDrawHeight * (1 - (180 - lMinY) / (lMaxY - lMinY));
      const ly70 = lPadTop + lDrawHeight * (1 - (70 - lMinY) / (lMaxY - lMinY));

      // 2. Gráfico Donut de TIR em SVG
      const rSize = 80;
      const rStroke = 10;
      const rRadius = (rSize - rStroke) / 2;
      const rCirc = 2 * Math.PI * rRadius;
      const rCenter = rSize / 2;

      const rSlices = [
        { percentage: tirPercentages.veryHigh, color: '#d946ef' },
        { percentage: tirPercentages.high, color: '#f97316' },
        { percentage: tirPercentages.inRange, color: '#0d9488' },
        { percentage: tirPercentages.low, color: '#f87171' },
        { percentage: tirPercentages.veryLow, color: '#ef4444' }
      ];

      let rAcc = 0;
      let rCircles = '';
      rSlices.forEach(slice => {
        if (slice.percentage > 0) {
          const strokeDasharray = `${(slice.percentage / 100) * rCirc} ${rCirc}`;
          const strokeDashoffset = -((rAcc / 100) * rCirc);
          rAcc += slice.percentage;
          rCircles += `<circle cx="${rCenter}" cy="${rCenter}" r="${rRadius}" fill="none" stroke="${slice.color}" stroke-width="${rStroke}" stroke-dasharray="${strokeDasharray}" stroke-dashoffset="${strokeDashoffset}" transform="rotate(-90 ${rCenter} ${rCenter})" stroke-linecap="round" />`;
        }
      });

      // 2b. Gráfico Histórico de Tempo no Alvo Diário (TIR Diário) em SVG
      const dailyTirWidth = 700;
      const dailyTirHeight = 120;
      const dtPadLeft = 40;
      const dtPadRight = 20;
      const dtPadTop = 10;
      const dtPadBottom = 20;
      const dtDrawWidth = dailyTirWidth - dtPadLeft - dtPadRight;
      const dtDrawHeight = dailyTirHeight - dtPadTop - dtPadBottom;
      const dtBarWidth = Math.max(4, (dtDrawWidth / Math.max(1, dailyStats.length)) * 0.6);

      let dailyTirBarsSvg = '';
      let dailyTirLabelsSvg = '';
      if (dailyStats.length > 0) {
        dailyStats.forEach((stat, idx) => {
          const x = dtPadLeft + (idx / Math.max(1, dailyStats.length - 1)) * (dtDrawWidth - dtBarWidth);
          const hasData = stat.hasData !== false && stat.tir !== null;
          const tirRatio = hasData ? (stat.tir / 100) : 0;
          const barHeight = dtDrawHeight * tirRatio;
          const y = dtPadTop + dtDrawHeight - barHeight;

          const bgColor = hasData ? 'rgba(239, 68, 68, 0.2)' : 'rgba(148, 163, 184, 0.08)';
          
          // Background da barra
          dailyTirBarsSvg += `<rect x="${x}" y="${dtPadTop}" width="${dtBarWidth}" height="${dtDrawHeight}" fill="${bgColor}" />`;
          
          // Barra de TIR verde
          if (hasData) {
            dailyTirBarsSvg += `<rect x="${x}" y="${y}" width="${dtBarWidth}" height="${barHeight}" fill="#0d9488" />`;
          }

          // Labels de data (mostradas espaçadamente)
          if (dailyStats.length <= 14 || idx % Math.ceil(dailyStats.length / 5) === 0) {
            dailyTirLabelsSvg += `<text x="${x + dtBarWidth / 2}" y="${dailyTirHeight - 5}" font-size="7px" fill="#64748b" text-anchor="middle">${stat.dateStr}</text>`;
          }
        });
      }

      // 2c. Gráfico Distribuição Horária do Tempo no Alvo (TIR por Hora) em SVG
      const hourlyTirWidth = 700;
      const hourlyTirHeight = 120;
      const htPadLeft = 40;
      const htPadRight = 20;
      const htPadTop = 10;
      const htPadBottom = 20;
      const htDrawWidth = hourlyTirWidth - htPadLeft - htPadRight;
      const htDrawHeight = hourlyTirHeight - htPadTop - htPadBottom;

      const getHtX = (hour: number) => htPadLeft + (hour / 23) * htDrawWidth;
      const getHtY = (val: number) => htPadTop + htDrawHeight * (1 - (val / 100));

      let hourlyPathD = '';
      let hourlyFillD = '';
      let hourlyLabelsSvg = '';

      if (hourlyTir.length > 0) {
        hourlyPathD = `M ${getHtX(0)} ${getHtY(hourlyTir[0])}`;
        hourlyFillD = `M ${getHtX(0)} ${htPadTop + htDrawHeight} L ${getHtX(0)} ${getHtY(hourlyTir[0])}`;

        for (let i = 1; i < 24; i++) {
          hourlyPathD += ` L ${getHtX(i)} ${getHtY(hourlyTir[i])}`;
          hourlyFillD += ` L ${getHtX(i)} ${getHtY(hourlyTir[i])}`;
        }
        hourlyFillD += ` L ${getHtX(23)} ${htPadTop + htDrawHeight} Z`;

        // Labels das horas (0h, 6h, 12h, 18h, 23h)
        [0, 6, 12, 18, 23].forEach(hour => {
          hourlyLabelsSvg += `<text x="${getHtX(hour)}" y="${hourlyTirHeight - 5}" font-size="7px" fill="#64748b" text-anchor="${hour === 0 ? 'start' : hour === 23 ? 'end' : 'middle'}">${hour}h</text>`;
        });
      }

      // 3. Tabela do Heatmap
      const daysName = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      let heatmapRowsHtml = '';
      
      const getPdfHeatmapColor = (val: number) => {
        if (val === 0) return '#f1f5f9';
        if (val < 70) return '#fee2e2';
        if (val <= 180) return '#ccfbf1';
        if (val <= 250) return '#ffedd5';
        return '#fae8ff';
      };

      const getPdfHeatmapTextColor = (val: number) => {
        if (val === 0) return '#94a3b8';
        if (val < 70) return '#991b1b';
        if (val <= 180) return '#115e59';
        if (val <= 250) return '#9a3412';
        return '#86198f';
      };

      for (let d = 0; d < 7; d++) {
        let cellsHtml = `<td style="font-weight: bold; background-color: #f8fafc; font-size: 9px; text-align: center; border: 1px solid #cbd5e1; padding: 4px;">${daysName[d]}</td>`;
        for (let h = 0; h < 24; h++) {
          const val = heatmapMatrix[d][h];
          const bg = getPdfHeatmapColor(val);
          const textCol = getPdfHeatmapTextColor(val);
          cellsHtml += `<td style="background-color: ${bg}; color: ${textCol}; font-weight: bold; font-size: 7.5px; text-align: center; height: 14px; width: 14px; border: 1px solid #cbd5e1;">${val > 0 ? val : '-'}</td>`;
        }
        heatmapRowsHtml += `<tr>${cellsHtml}</tr>`;
      }

      // 4. Insights Clínicos
      let insightsHtml = '';
      const insights = generateClinicalInsights();
      insights.forEach(ins => {
        const typeColors: any = {
          success: { border: '#0d9488', bg: '#f0fdfa', text: '#115e59' },
          warning: { border: '#f97316', bg: '#fff7ed', text: '#9a3412' },
          danger: { border: '#ef4444', bg: '#fef2f2', text: '#991b1b' },
          info: { border: '#0ea5e9', bg: '#f0f9ff', text: '#075985' }
        };
        const colors = typeColors[ins.type] || typeColors.info;
        insightsHtml += `
          <div style="margin-bottom: 10px; padding: 10px; border-left: 4px solid ${colors.border}; background-color: ${colors.bg}; border-radius: 4px; display: flex; align-items: flex-start; gap: 8px;">
            <span style="font-size: 16px;">${ins.icon}</span>
            <div>
              <strong style="color: ${colors.text}; font-size: 11px;">${ins.title}</strong><br/>
              <span style="font-size: 10px; color: #475569; line-height: 1.3;">${ins.message}</span>
            </div>
          </div>
        `;
      });

      // 5. Tabela de Estatísticas Diárias
      let dailyRowsHtml = '';
      dailyStats.slice().reverse().forEach(stat => {
        const hasData = stat.hasData !== false && stat.avg !== null;
        const avgText = hasData ? `${stat.avg} mg/dL` : '-';
        const tirText = hasData ? `${stat.tir}%` : '-';
        const sdText = hasData ? `${stat.sd} mg/dL` : '-';
        
        const avgColor = hasData ? (stat.avg > 180 ? '#f97316' : stat.avg < 70 ? '#ef4444' : '#0d9488') : '#64748b';
        const tirColor = hasData ? (stat.tir >= 70 ? '#0d9488' : '#f97316') : '#64748b';
        
        dailyRowsHtml += `
          <tr>
            <td style="padding: 4px; border-bottom: 1px solid #e2e8f0; font-size: 9px;">${stat.dateStr}</td>
            <td style="padding: 4px; border-bottom: 1px solid #e2e8f0; font-size: 9px; font-weight: ${hasData ? 'bold' : 'normal'}; text-align: center; color: ${avgColor};">${avgText}</td>
            <td style="padding: 4px; border-bottom: 1px solid #e2e8f0; font-size: 9px; font-weight: ${hasData ? 'bold' : 'normal'}; text-align: center; color: ${tirColor};">${tirText}</td>
            <td style="padding: 4px; border-bottom: 1px solid #e2e8f0; font-size: 9px; text-align: right; color: #64748b;">${sdText}</td>
          </tr>
        `;
      });

      // HTML Final do Relatório
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Relatório Clínico - TnD Scout</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 12px; background-color: #ffffff; }
            h1 { font-size: 16px; font-weight: 800; color: #0f172a; margin: 0 0 2px 0; }
            h2 { font-size: 9px; color: #475569; margin: 0 0 8px 0; font-weight: normal; }
            h3 { font-size: 9.5px; font-weight: 700; text-transform: uppercase; color: #1e293b; margin: 12px 0 6px 0; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; }
            .grid-metrics { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
            .metric-card { flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px; text-align: center; background-color: #f8fafc; }
            .metric-label { font-size: 8px; color: #64748b; font-weight: bold; text-transform: uppercase; }
            .metric-value { font-size: 20px; font-weight: 900; margin: 2px 0; }
            .metric-unit { font-size: 8px; color: #64748b; }
            .section-chart { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; margin-bottom: 10px; background-color: #f8fafc; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            th { text-align: left; padding: 4px 4px; font-size: 8px; font-weight: bold; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #cbd5e1; }
            .tir-row { display: flex; gap: 15px; align-items: center; margin-bottom: 10px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; }
            .tir-legend { flex: 1; display: flex; flex-direction: column; gap: 4px; }
            .legend-item { display: flex; align-items: center; justify-content: space-between; font-size: 8.5px; border-bottom: 1px solid #f1f5f9; padding-bottom: 2px; }
            .legend-indicator { width: 6px; height: 6px; border-radius: 1px; display: inline-block; margin-right: 4px; }
          </style>
        </head>
        <body>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 6px; margin-bottom: 10px;">
            <div>
              <h1>TnD Scout &middot; Relatório Clínico</h1>
              <h2>Paciente: <strong>${name}</strong> &middot; Período de Análise: ${selectedDays} ${selectedDays === 1 ? 'dia' : 'dias'} &middot; Emitido em: ${new Date().toLocaleDateString('pt-BR')}</h2>
            </div>
            <div style="text-align: right; font-size: 7.5px; color: #64748b;">
              <strong>Nightscout Conectado:</strong><br/>
              <span style="font-family: monospace;">${url}</span>
            </div>
          </div>

          <div class="grid-metrics">
            <div class="metric-card">
              <div class="metric-label">Glicose Média</div>
              <div class="metric-value" style="color: ${avgGlucose >= 70 && avgGlucose <= 180 ? '#0d9488' : avgGlucose > 180 ? '#f97316' : '#ef4444'};">${avgGlucose}</div>
              <div class="metric-unit">mg/dL</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Variabilidade (SD)</div>
              <div class="metric-value" style="color: #0f172a;">${sdGlucose}</div>
              <div class="metric-unit">mg/dL</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">eA1C Estimada</div>
              <div class="metric-value" style="color: ${ea1c <= 7.0 ? '#0d9488' : '#f97316'};">${ea1c}%</div>
              <div class="metric-unit">padrão ADA</div>
            </div>
          </div>

          <h3>🎯 Tempo na Faixa (Time in Range)</h3>
          <div class="tir-row">
            <svg width="${rSize}" height="${rSize}">
              <circle cx="${rCenter}" cy="${rCenter}" r="${rRadius}" fill="none" stroke="#e2e8f0" stroke-width="${rStroke}" />
              ${rCircles}
              <text x="${rCenter}" y="${rCenter + 4}" font-size="16" font-weight="900" fill="#0d9488" text-anchor="middle">${tirPercentages.inRange}%</text>
              <text x="${rCenter}" y="${rCenter + 14}" font-size="7" font-weight="bold" fill="#64748b" text-anchor="middle" style="text-transform: uppercase;">No Alvo</text>
            </svg>
            <div class="tir-legend">
              <div class="legend-item">
                <div><span class="legend-indicator" style="background-color: #d946ef;"></span>Muito Alto (&gt;250 mg/dL)</div>
                <strong>${tirPercentages.veryHigh}%</strong>
              </div>
              <div class="legend-item">
                <div><span class="legend-indicator" style="background-color: #f97316;"></span>Alto (181-250 mg/dL)</div>
                <strong>${tirPercentages.high}%</strong>
              </div>
              <div class="legend-item" style="background-color: #f0fdfa; padding: 4px; border-radius: 4px;">
                <div><span class="legend-indicator" style="background-color: #0d9488;"></span>Ideal (70-180 mg/dL)</div>
                <strong style="color: #0d9488; font-size: 11px;">${tirPercentages.inRange}%</strong>
              </div>
              <div class="legend-item">
                <div><span class="legend-indicator" style="background-color: #f87171;"></span>Baixo (54-69 mg/dL)</div>
                <strong>${tirPercentages.low}%</strong>
              </div>
              <div class="legend-item">
                <div><span class="legend-indicator" style="background-color: #ef4444;"></span>Muito Baixo (&lt;54 mg/dL)</div>
                <strong>${tirPercentages.veryLow}%</strong>
              </div>
            </div>
          </div>

          <h3>📈 Evolução Glicêmica do Período</h3>
          <div class="section-chart">
            <svg width="100%" height="${lineSvgHeight}" viewBox="0 0 ${lineSvgWidth} ${lineSvgHeight}">
              <rect x="${lPadLeft}" y="${ly180}" width="${lDrawWidth}" height="${ly70 - ly180}" fill="rgba(13, 148, 136, 0.05)" />
              <line x1="${lPadLeft}" y1="${ly180}" x2="${lineSvgWidth - lPadRight}" y2="${ly180}" stroke="rgba(249, 115, 22, 0.3)" stroke-width="1" stroke-dasharray="3 3" />
              <line x1="${lPadLeft}" y1="${ly70}" x2="${lineSvgWidth - lPadRight}" y2="${ly70}" stroke="rgba(239, 68, 68, 0.3)" stroke-width="1" stroke-dasharray="3 3" />
              
              <text x="${lPadLeft - 6}" y="${ly180 + 3}" font-size="8px" fill="#64748b" text-anchor="end" font-weight="bold">180</text>
              <text x="${lPadLeft - 6}" y="${ly70 + 3}" font-size="8px" fill="#64748b" text-anchor="end" font-weight="bold">70</text>
              <text x="${lPadLeft - 6}" y="${lPadTop + lDrawHeight + 3}" font-size="8px" fill="#94a3b8" text-anchor="end">40</text>
              <text x="${lPadLeft - 6}" y="${lPadTop + 3}" font-size="8px" fill="#94a3b8" text-anchor="end">400</text>
              
              <path d="${linePoints}" fill="none" stroke="#6366f1" stroke-width="1.8" />
              
              <text x="${lPadLeft}" y="${lineSvgHeight - 5}" font-size="8px" fill="#64748b" text-anchor="start">${selectedDays} ${selectedDays === 1 ? 'dia' : 'dias'} atrás</text>
              <text x="${lPadLeft + lDrawWidth / 2}" y="${lineSvgHeight - 5}" font-size="8px" fill="#64748b" text-anchor="middle">Metade</text>
              <text x="${lPadLeft + lDrawWidth}" y="${lineSvgHeight - 5}" font-size="8px" fill="#64748b" text-anchor="end">AGORA</text>
            </svg>
            <div style="display: flex; justify-content: center; gap: 15px; font-size: 8px; color: #64748b; margin-top: 6px;">
              <div><span style="display: inline-block; width: 8px; height: 8px; background-color: #6366f1; border-radius: 1px; margin-right: 4px; vertical-align: middle;"></span>Glicose (CGM)</div>
              <div><span style="display: inline-block; width: 8px; height: 6px; border: 1px dashed #0d9488; background-color: rgba(13,148,136,0.03); margin-right: 4px; vertical-align: middle;"></span>Faixa Ideal (70-180 mg/dL)</div>
            </div>
          </div>

          <h3>📊 Histórico de Tempo no Alvo Diário</h3>
          <div class="section-chart">
            <svg width="100%" height="${dailyTirHeight}" viewBox="0 0 ${dailyTirWidth} ${dailyTirHeight}">
              <line x1="${dtPadLeft}" y1="${dtPadTop}" x2="${dailyTirWidth - dtPadRight}" y2="${dtPadTop}" stroke="rgba(0,0,0,0.1)" stroke-width="1" stroke-dasharray="2 2" />
              <line x1="${dtPadLeft}" y1="${dtPadTop + dtDrawHeight / 2}" x2="${dailyTirWidth - dtPadRight}" y2="${dtPadTop + dtDrawHeight / 2}" stroke="rgba(0,0,0,0.1)" stroke-width="1" stroke-dasharray="2 2" />
              <line x1="${dtPadLeft}" y1="${dtPadTop + dtDrawHeight}" x2="${dailyTirWidth - dtPadRight}" y2="${dtPadTop + dtDrawHeight}" stroke="rgba(0,0,0,0.3)" stroke-width="1" />
              
              <text x="${dtPadLeft - 6}" y="${dtPadTop + 3}" font-size="7px" fill="#64748b" text-anchor="end" font-weight="bold">100%</text>
              <text x="${dtPadLeft - 6}" y="${dtPadTop + dtDrawHeight / 2 + 3}" font-size="7px" fill="#64748b" text-anchor="end" font-weight="bold">50%</text>
              
              ${dailyTirBarsSvg}
              ${dailyTirLabelsSvg}
            </svg>
            <div style="display: flex; justify-content: center; gap: 15px; font-size: 8px; color: #64748b; margin-top: 6px;">
              <div><span style="display: inline-block; width: 8px; height: 8px; background-color: #0d9488; border-radius: 1px; margin-right: 4px; vertical-align: middle;"></span>No Alvo (70-180 mg/dL)</div>
              <div><span style="display: inline-block; width: 8px; height: 8px; background-color: rgba(239, 68, 68, 0.2); border-radius: 1px; margin-right: 4px; vertical-align: middle;"></span>Fora do Alvo</div>
            </div>
          </div>

          <h3>⚡ Distribuição Horária do Tempo no Alvo</h3>
          <div class="section-chart">
            <svg width="100%" height="${hourlyTirHeight}" viewBox="0 0 ${hourlyTirWidth} ${hourlyTirHeight}">
              <defs>
                <linearGradient id="htGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#0ea5e9" stop-opacity="0.3" />
                  <stop offset="100%" stop-color="#0ea5e9" stop-opacity="0.0" />
                </linearGradient>
              </defs>
              <line x1="${htPadLeft}" y1="${htPadTop}" x2="${hourlyTirWidth - htPadRight}" y2="${htPadTop}" stroke="rgba(0,0,0,0.1)" stroke-width="1" stroke-dasharray="2 2" />
              <line x1="${htPadLeft}" y1="${htPadTop + htDrawHeight / 2}" x2="${hourlyTirWidth - htPadRight}" y2="${htPadTop + htDrawHeight / 2}" stroke="rgba(0,0,0,0.1)" stroke-width="1" stroke-dasharray="2 2" />
              <line x1="${htPadLeft}" y1="${htPadTop + htDrawHeight}" x2="${hourlyTirWidth - htPadRight}" y2="${htPadTop + htDrawHeight}" stroke="rgba(0,0,0,0.3)" stroke-width="1" />
              
              <text x="${htPadLeft - 6}" y="${htPadTop + 3}" font-size="7px" fill="#64748b" text-anchor="end" font-weight="bold">100%</text>
              <text x="${htPadLeft - 6}" y="${htPadTop + htDrawHeight / 2 + 3}" font-size="7px" fill="#64748b" text-anchor="end" font-weight="bold">50%</text>
              
              <path d="${hourlyFillD}" fill="url(#htGrad)" />
              <path d="${hourlyPathD}" fill="none" stroke="#0ea5e9" stroke-width="2" />
              ${hourlyLabelsSvg}
            </svg>
            <div style="font-size: 8px; color: #64748b; margin-top: 6px; text-align: center;">
              <span style="display: inline-block; width: 8px; height: 8px; background-color: #0ea5e9; border-radius: 1px; margin-right: 4px; vertical-align: middle;"></span>TIR Médio por Hora (0h-23h)
            </div>
          </div>

          <!-- Remoção de quebra de página manual para maior compactação -->

          <h3>💡 Insights Clínicos do Período</h3>
          <div style="margin-bottom: 20px;">
            ${insightsHtml.length > 0 ? insightsHtml : '<p style="font-size: 10px; font-style: italic; color: #64748b;">Sem insights disponíveis para este período.</p>'}
          </div>

          <h3>🔥 Mapa de Calor Glicêmico (AGP 24H)</h3>
          <table style="width: 100%; border: 1px solid #cbd5e1; margin-bottom: 10px;">
            <thead>
              <tr style="background-color: #f1f5f9;">
                <th style="width: 30px; border: 1px solid #cbd5e1; padding: 2px; font-size: 7.5px; text-align: center;">Dia</th>
                ${Array(24).fill(null).map((_, i) => `<th style="text-align: center; font-size: 6.5px; width: 16px; border: 1px solid #cbd5e1; padding: 1px;">${i}h</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${heatmapRowsHtml}
            </tbody>
          </table>
          <div style="display: flex; gap: 15px; font-size: 8px; color: #64748b; justify-content: center; margin-bottom: 25px;">
            <div><span style="display: inline-block; width: 12px; height: 12px; background-color: #fee2e2; border: 1px solid #fca5a5; margin-right: 4px; vertical-align: middle;"></span>Alerta Grave / Hipoglicemia (<70 mg/dL)</div>
            <div><span style="display: inline-block; width: 12px; height: 12px; background-color: #ccfbf1; border: 1px solid #99f6e4; margin-right: 4px; vertical-align: middle;"></span>Faixa Ideal (70-180 mg/dL)</div>
            <div><span style="display: inline-block; width: 12px; height: 12px; background-color: #ffedd5; border: 1px solid #fed7aa; margin-right: 4px; vertical-align: middle;"></span>Alerta Alto (181-250 mg/dL)</div>
          </div>

          <h3>📅 Resumo Estatístico Diário</h3>
          <table style="width: 100%; border: 1px solid #cbd5e1;">
            <thead>
              <tr style="background-color: #f1f5f9;">
                <th style="padding: 6px; border: 1px solid #cbd5e1; font-size: 9px;">Data</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1; font-size: 9px; text-align: center;">Média de Glicose</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1; font-size: 9px; text-align: center;">Tempo no Alvo (TIR)</th>
                <th style="padding: 6px; border: 1px solid #cbd5e1; font-size: 9px; text-align: right;">Variabilidade (SD)</th>
              </tr>
            </thead>
            <tbody>
              ${dailyRowsHtml.length > 0 ? dailyRowsHtml : '<tr><td colspan="4" style="text-align: center; padding: 10px; font-size: 10px; font-style: italic;">Nenhum registro diário disponível.</td></tr>'}
            </tbody>
          </table>
        </body>
        </html>
      `;

      // Gerar PDF físico local
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      
      // Abrir menu de compartilhamento do arquivo gerado
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Relatório Clínico - ${name}`,
        UTI: 'com.adobe.pdf'
      });
      
    } catch (err: any) {
      console.error(err);
      Alert.alert('Erro ao Exportar', err.message || 'Ocorreu um erro ao gerar o PDF.');
    } finally {
      setExportingPdf(false);
    }
  };

  // Enviar novo tratamento ao Careportal do Nightscout
  const handleAddTreatment = async () => {
    if (tType !== 'Note' && !tCarbs.trim() && !tInsulin.trim() && !tGlucose.trim()) {
      Alert.alert('Aviso', 'Preencha ao menos uma das informações (Carboidratos, Insulina ou Glicemia).');
      return;
    }

    setSubmittingTreatment(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error('Sessão expirada. Faça login novamente.');

      const treatmentBody: any = {
        enteredBy: 'TnD Scout Mobile',
        eventType: tType,
        created_at: new Date().toISOString(),
      };

      if (tCarbs.trim()) treatmentBody.carbs = Number(tCarbs);
      if (tInsulin.trim()) treatmentBody.insulin = Number(tInsulin);
      if (tGlucose.trim()) treatmentBody.glucose = Number(tGlucose);
      if (tNotes.trim()) treatmentBody.notes = tNotes.trim();

      const proxyPostUrl = `https://tndscout.vercel.app/api/patient/proxy?patientId=${id}&endpoint=api/v1/treatments.json`;

      const res = await fetch(proxyPostUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(treatmentBody)
      });

      if (!res.ok) {
        throw new Error('Falha ao registrar tratamento no Nightscout.');
      }

      setIsAddTreatmentModalOpen(false);
      setTCarbs('');
      setTInsulin('');
      setTGlucose('');
      setTNotes('');
      Alert.alert('Sucesso', 'Tratamento registrado com sucesso no Careportal!');
      fetchReportData(); // Atualiza a timeline
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao salvar o registro.');
    } finally {
      setSubmittingTreatment(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [id]);

  // Estilos de Tema
  const isDarkTheme = isDark;
  const stylesTheme = StyleSheet.create({
    container: { backgroundColor: isDarkTheme ? '#020617' : '#f1f5f9' },
    card: {
      backgroundColor: isDarkTheme ? 'rgba(15, 23, 42, 0.45)' : '#ffffff',
      borderColor: isDarkTheme ? 'rgba(255, 255, 255, 0.05)' : '#cbd5e1',
    },
    text: { color: isDarkTheme ? '#f8fafc' : '#0f172a' },
    textSec: { color: isDarkTheme ? '#94a3b8' : '#475569' },
    header: {
      backgroundColor: isDarkTheme ? 'rgba(15, 23, 42, 0.8)' : '#ffffff',
      borderBottomColor: isDarkTheme ? 'rgba(255, 255, 255, 0.05)' : '#cbd5e1',
    },
    tabBar: {
      backgroundColor: isDarkTheme ? 'rgba(15, 23, 42, 0.45)' : '#ffffff',
      borderBottomColor: isDarkTheme ? 'rgba(255, 255, 255, 0.05)' : '#e2e8f0',
    },
    input: {
      backgroundColor: isDarkTheme ? 'rgba(2, 6, 23, 0.45)' : '#f8fafc',
      borderColor: isDarkTheme ? 'rgba(255, 255, 255, 0.08)' : '#cbd5e1',
      color: isDarkTheme ? '#f8fafc' : '#0f172a',
    },
    modalContent: {
      backgroundColor: isDarkTheme ? '#0f172a' : '#ffffff',
    }
  });

  // Extrator de Dados Metabólicos v2
  const getMetabolicData = () => {
    let iob = 0;
    let cob = 0;
    let basalText = 'N/A';
    if (properties) {
      const p = properties;
      if (p.iob && p.iob.iob !== undefined) iob = parseFloat(p.iob.iob);
      else if (p.bwp && p.bwp.iob !== undefined) iob = parseFloat(p.bwp.iob);
      else if (p.iob && p.iob.display !== undefined) iob = parseFloat(p.iob.display) || 0;

      if (p.cob && p.cob.cob !== undefined) cob = parseFloat(p.cob.cob);
      else if (p.bwp && p.bwp.cob !== undefined) cob = parseFloat(p.bwp.cob);
      else if (p.cob && p.cob.display !== undefined) cob = parseFloat(p.cob.display) || 0;

      if (p.basal) {
        if (p.basal.current && p.basal.current.totalbasal !== undefined) {
          basalText = `${parseFloat(p.basal.current.totalbasal).toFixed(2)} U/h`;
        } else if (p.basal.display !== undefined) {
          basalText = p.basal.display;
        }
      }
    }
    return { iob, cob, basalText };
  };

  // Extrator de Parâmetros Clínicos
  const getProfileParams = () => {
    let isf = 50;
    let cr = 10;
    try {
      if (profile && Array.isArray(profile) && profile.length > 0) {
        const defaultProfile = profile[0].defaultProfile || 'Default';
        const store = profile[0].store || {};
        const activeStore = store[defaultProfile] || {};
        if (activeStore.sens && activeStore.sens.length > 0) {
          isf = Number(activeStore.sens[0].value) || 50;
        }
        if (activeStore.carbratio && activeStore.carbratio.length > 0) {
          cr = Number(activeStore.carbratio[0].value) || 10;
        }
      }
    } catch (e) {
      console.warn('Erro ao ler parâmetros do perfil:', e);
    }
    return { isf, cr };
  };

  // Extrator de Array Basal Programado
  const getBasalArray = () => {
    try {
      if (!profile || !Array.isArray(profile) || profile.length === 0) return [];
      const defaultProfile = profile[0].defaultProfile || 'Default';
      const store = profile[0].store || {};
      const activeStore = store[defaultProfile] || {};
      const basal = activeStore.basal || [];
      if (Array.isArray(basal) && basal.length > 0) {
        return basal.map(b => ({
          time: b.time || '00:00',
          value: Number(b.value) || 0
        }));
      }
    } catch (e) {
      console.warn('Erro ao extrair basal profile:', e);
    }
    return [];
  };

  // Tradutor de Lógica do Loop em Português
  const translateLoopReason = (reason: string) => {
    if (!reason) return 'Nenhuma ação do Loop necessária no momento.';
    let t = reason;
    t = t.replace(/no temp required/gi, 'Nenhuma alteração de basal necessária');
    t = t.replace(/temp basal of (\d+\.?\d*)U\/h for (\d+)m required/gi, 'Basal temporário de $1 U/h por $2 min necessário');
    t = t.replace(/suggested temp basal (\d+\.?\d*)U\/h/gi, 'Sugerido basal temporário de $1 U/h');
    t = t.replace(/enacted temp basal (\d+\.?\d*)U\/h/gi, 'Aplicado basal temporário de $1 U/h');
    t = t.replace(/setting temp basal to (\d+\.?\d*)U\/h for (\d+)m/gi, 'Ajustando basal temporário para $1 U/h por $2 min');
    t = t.replace(/carbs (\d+)g/gi, '$1g de carboidratos');
    t = t.replace(/insulin (\d+\.?\d*)U/gi, '$1 U de insulina');
    t = t.replace(/BG (\d+)/gi, 'Glicose $1 mg/dL');
    t = t.replace(/cancel temp/gi, 'Cancelar basal temporário');
    t = t.replace(/is greater than/gi, 'é maior que');
    t = t.replace(/is less than/gi, 'é menor que');
    t = t.replace(/no temp set/gi, 'Nenhum basal temporário ativo');
    if (t.length > 80 && t.includes('->')) {
      const parts = t.split('->');
      t = parts[parts.length - 1].trim();
    }
    return t;
  };

  // 1. Gráfico SVG de Evolução de Glicose (com Subamostragem Otimizada)
  const renderLineChart = () => {
    if (entries.length === 0) return null;

    const graphWidth = screenWidth - 32;
    const graphHeight = 160;
    const paddingLeft = 32;
    const paddingRight = 10;
    const paddingTop = 15;
    const paddingBottom = 20;

    const drawableWidth = graphWidth - paddingLeft - paddingRight;
    const drawableHeight = graphHeight - paddingTop - paddingBottom;

    const minY = 40;
    const maxY = 400;

    // Subamostragem inteligente se houver muitos dados (para evitar travamento no SVG)
    const limitPoints = 250;
    const step = Math.ceil(entries.length / limitPoints);
    const sampledEntries = entries.filter((_, idx) => idx % step === 0 || idx === entries.length - 1);

    // Mapear pontos (X, Y)
    const points = sampledEntries.map((entry, index) => {
      const x = paddingLeft + (index / (sampledEntries.length - 1)) * drawableWidth;
      const ratio = (entry.sgv - minY) / (maxY - minY);
      const boundedRatio = Math.max(0, Math.min(1, ratio));
      const y = paddingTop + drawableHeight * (1 - boundedRatio);
      return { x, y };
    });

    let pathD = '';
    let fillD = '';

    if (points.length > 0) {
      pathD = `M ${points[0].x} ${points[0].y}`;
      fillD = `M ${points[0].x} ${paddingTop + drawableHeight} L ${points[0].x} ${points[0].y}`;

      for (let i = 1; i < points.length; i++) {
        pathD += ` L ${points[i].x} ${points[i].y}`;
        fillD += ` L ${points[i].x} ${points[i].y}`;
      }

      fillD += ` L ${points[points.length - 1].x} ${paddingTop + drawableHeight} Z`;
    }

    const y180 = paddingTop + drawableHeight * (1 - (180 - minY) / (maxY - minY));
    const y70 = paddingTop + drawableHeight * (1 - (70 - minY) / (maxY - minY));

    return (
      <View style={styles.chartContainer}>
        <Svg width={graphWidth} height={graphHeight}>
          <Defs>
            <LinearGradient id="glucoseGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
              <Stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
            </LinearGradient>
          </Defs>

          {/* Faixa Ideal */}
          <Path
            d={`M ${paddingLeft} ${y180} L ${graphWidth - paddingRight} ${y180} L ${graphWidth - paddingRight} ${y70} L ${paddingLeft} ${y70} Z`}
            fill={isDarkTheme ? 'rgba(13, 148, 136, 0.05)' : 'rgba(13, 148, 136, 0.04)'}
          />

          {/* Linhas de Grade limites do TIR */}
          <Line x1={paddingLeft} y1={y180} x2={graphWidth - paddingRight} y2={y180} stroke={isDarkTheme ? 'rgba(249, 115, 22, 0.25)' : 'rgba(249, 115, 22, 0.15)'} strokeWidth="1" strokeDasharray="4 4" />
          <Line x1={paddingLeft} y1={y70} x2={graphWidth - paddingRight} y2={y70} stroke={isDarkTheme ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.15)'} strokeWidth="1" strokeDasharray="4 4" />

          {/* Rótulos do Eixo Y */}
          <SvgText x={paddingLeft - 8} y={y180 + 3} fontSize="8.5" fill={isDarkTheme ? '#94a3b8' : '#64748b'} textAnchor="end" fontWeight="bold">180</SvgText>
          <SvgText x={paddingLeft - 8} y={y70 + 3} fontSize="8.5" fill={isDarkTheme ? '#94a3b8' : '#64748b'} textAnchor="end" fontWeight="bold">70</SvgText>
          <SvgText x={paddingLeft - 8} y={paddingTop + drawableHeight + 3} fontSize="8.5" fill={isDarkTheme ? '#475569' : '#94a3b8'} textAnchor="end">40</SvgText>
          <SvgText x={paddingLeft - 8} y={paddingTop + 3} fontSize="8.5" fill={isDarkTheme ? '#475569' : '#94a3b8'} textAnchor="end">400</SvgText>

          {/* Curva de Preenchimento */}
          {fillD !== '' && <Path d={fillD} fill="url(#glucoseGrad)" />}

          {/* Curva Principal */}
          {pathD !== '' && <Path d={pathD} fill="none" stroke="#6366f1" strokeWidth="2.2" />}

          {/* Rótulos de tempo no Eixo X */}
          <SvgText x={paddingLeft} y={graphHeight - 4} fontSize="8.5" fill={isDarkTheme ? '#64748b' : '#94a3b8'} textAnchor="start">{selectedDays} {selectedDays === 1 ? 'dia' : 'dias'} atrás</SvgText>
          <SvgText x={paddingLeft + drawableWidth / 2} y={graphHeight - 4} fontSize="8.5" fill={isDarkTheme ? '#64748b' : '#94a3b8'} textAnchor="middle">Metade</SvgText>
          <SvgText x={paddingLeft + drawableWidth} y={graphHeight - 4} fontSize="8.5" fill={isDarkTheme ? '#64748b' : '#94a3b8'} textAnchor="end">AGORA</SvgText>
        </Svg>
        {/* Legenda Glicemia Sensor */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 12, marginTop: 10, paddingHorizontal: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#6366f1' }} />
            <Text style={{ fontSize: 11 * fontScale, color: isDarkTheme ? '#f1f5f9' : '#1e293b', fontWeight: '700' }}>Glicose (CGM)</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 8, backgroundColor: isDarkTheme ? 'rgba(13, 148, 136, 0.04)' : 'rgba(13, 148, 136, 0.02)', borderWidth: 1.2, borderColor: '#0d9488', borderStyle: 'dashed' }} />
            <Text style={{ fontSize: 11 * fontScale, color: isDarkTheme ? '#f1f5f9' : '#1e293b', fontWeight: '700' }}>Alvo (70-180 mg/dL)</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 2, backgroundColor: '#f97316' }} />
            <Text style={{ fontSize: 11 * fontScale, color: isDarkTheme ? '#f1f5f9' : '#1e293b', fontWeight: '700' }}>{"Alto (>180)"}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 2, backgroundColor: '#ef4444' }} />
            <Text style={{ fontSize: 11 * fontScale, color: isDarkTheme ? '#f1f5f9' : '#1e293b', fontWeight: '700' }}>{"Baixo (<70)"}</Text>
          </View>
        </View>
      </View>
    );
  };

  // 2. Gráfico Donut de Time in Range (Rosquinha TIR)
  const renderDonutChart = () => {
    const size = 94;
    const strokeWidth = 14;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const center = size / 2;

    const data = [
      { percentage: tirPercentages.veryHigh, color: '#d946ef' },
      { percentage: tirPercentages.high, color: '#f97316' },
      { percentage: tirPercentages.inRange, color: '#0d9488' },
      { percentage: tirPercentages.low, color: '#f87171' },
      { percentage: tirPercentages.veryLow, color: '#ef4444' }
    ];

    const totalPerc = data.reduce((acc, curr) => acc + curr.percentage, 0);
    if (totalPerc === 0) {
      return (
        <Svg width={size} height={size}>
          <Circle cx={center} cy={center} r={radius} fill="none" stroke={isDarkTheme ? '#334155' : '#cbd5e1'} strokeWidth={strokeWidth} />
        </Svg>
      );
    }

    let accumulatedPercentage = 0;

    return (
      <View style={{ position: 'relative', width: size, height: size }}>
        <Svg width={size} height={size}>
          <G rotation="-90" origin={`${center}, ${center}`}>
            {data.map((item, index) => {
              if (item.percentage === 0) return null;
              const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
              const strokeDashoffset = -((accumulatedPercentage / 100) * circumference);
              accumulatedPercentage += item.percentage;

              return (
                <Circle
                  key={index}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={item.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              );
            })}
          </G>
        </Svg>
        <View style={styles.donutCenterTextContainer}>
          <Text style={[styles.donutCenterValue, { color: isDarkTheme ? '#0d9488' : '#0f9488', fontSize: 13.5 * fontScale }]}>
            {tirPercentages.inRange}%
          </Text>
          <Text style={{ fontSize: 6.5, fontWeight: '700', color: isDarkTheme ? '#64748b' : '#94a3b8', textTransform: 'uppercase' }}>
            Ideal
          </Text>
        </View>
      </View>
    );
  };

  // 3. Gráfico SVG de Projeção Metabólica (Forecast 90 Minutos)
  const renderForecastChart = () => {
    if (entries.length === 0) return null;

    const { iob, cob } = getMetabolicData();
    const { isf, cr } = getProfileParams();

    // Pegar últimas 2.5 horas de dados glicêmicos reais (30 leituras)
    const recentReal = entries.slice(-30);
    if (recentReal.length === 0) return null;

    const latestReal = recentReal[recentReal.length - 1];
    const latestGlucose = latestReal.sgv;
    const latestTime = latestReal.date;

    // Calcular tendência linear recente (últimos 15 min - 4 leituras atrás)
    let linearTrend = 0;
    if (recentReal.length >= 4) {
      const refReal = recentReal[recentReal.length - 4];
      const deltaG = latestGlucose - refReal.sgv;
      const deltaT = (latestTime - refReal.date) / 60000;
      if (deltaT > 0) linearTrend = deltaG / deltaT;
    }

    // Projetar 90 minutos do futuro (18 intervalos de 5 min)
    const predictions: { date: number; val: number }[] = [{ date: latestTime, val: latestGlucose }];
    for (let i = 1; i <= 18; i++) {
      const minutes = i * 5;
      const fTime = latestTime + minutes * 60000;
      // Tendência linear amortecida após 120min
      const decayTrendFactor = Math.max(0, 1 - minutes / 120);
      const trendEffect = linearTrend * minutes * decayTrendFactor;

      // Ganho de glicemia pela absorção do carboidrato ativo (COB)
      const carbFactor = isf / cr;
      const cobEffect = cob * carbFactor * (1 - Math.exp(-minutes / 45)) * 0.7;

      // Queda de glicemia pelo decaimento da insulina ativa (IOB)
      const insulinEffect = iob * isf * (1 - Math.exp(-minutes / 60)) * 0.6;

      let projectedValue = Math.round(latestGlucose + trendEffect + cobEffect - insulinEffect);
      projectedValue = Math.max(39, Math.min(400, projectedValue));

      predictions.push({ date: fTime, val: projectedValue });
    }

    // Unir dados no gráfico
    const graphWidth = screenWidth - 32;
    const graphHeight = 140;
    const paddingLeft = 30;
    const paddingRight = 10;
    const paddingTop = 12;
    const paddingBottom = 20;

    const drawableWidth = graphWidth - paddingLeft - paddingRight;
    const drawableHeight = graphHeight - paddingTop - paddingBottom;

    const minY = 40;
    const maxY = 400;

    const totalPoints = recentReal.length + predictions.length - 1; // Unir no ponto de transição

    const getX = (index: number) => paddingLeft + (index / (totalPoints - 1)) * drawableWidth;
    const getY = (val: number) => {
      const ratio = (val - minY) / (maxY - minY);
      return paddingTop + drawableHeight * (1 - ratio);
    };

    // Desenhar linha real
    let realPath = `M ${getX(0)} ${getY(recentReal[0].sgv)}`;
    for (let i = 1; i < recentReal.length; i++) {
      realPath += ` L ${getX(i)} ${getY(recentReal[i].sgv)}`;
    }

    // Desenhar linha de projeção (Forecast)
    let forecastPath = `M ${getX(recentReal.length - 1)} ${getY(predictions[0].val)}`;
    for (let i = 1; i < predictions.length; i++) {
      const idx = recentReal.length - 1 + i;
      forecastPath += ` L ${getX(idx)} ${getY(predictions[i].val)}`;
    }

    const y180 = getY(180);
    const y70 = getY(70);

    return (
      <View style={styles.chartContainer}>
        <Svg width={graphWidth} height={graphHeight}>
          {/* Faixas delimitadoras */}
          <Path
            d={`M ${paddingLeft} ${y180} L ${graphWidth - paddingRight} ${y180} L ${graphWidth - paddingRight} ${y70} L ${paddingLeft} ${y70} Z`}
            fill={isDarkTheme ? 'rgba(13, 148, 136, 0.05)' : 'rgba(13, 148, 136, 0.04)'}
          />
          <Line x1={paddingLeft} y1={y180} x2={graphWidth - paddingRight} y2={y180} stroke={isDarkTheme ? 'rgba(249, 115, 22, 0.2)' : 'rgba(249, 115, 22, 0.12)'} strokeWidth="1" strokeDasharray="3 3" />
          <Line x1={paddingLeft} y1={y70} x2={graphWidth - paddingRight} y2={y70} stroke={isDarkTheme ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.12)'} strokeWidth="1" strokeDasharray="3 3" />

          {/* Rótulos Eixo Y */}
          <SvgText x={paddingLeft - 6} y={y180 + 3} fontSize="8" fill={isDarkTheme ? '#94a3b8' : '#64748b'} textAnchor="end">180</SvgText>
          <SvgText x={paddingLeft - 6} y={y70 + 3} fontSize="8" fill={isDarkTheme ? '#94a3b8' : '#64748b'} textAnchor="end">70</SvgText>

          {/* Linha Real */}
          <Path d={realPath} fill="none" stroke="#0d9488" strokeWidth="2.2" />

          {/* Linha de Projeção Metabólica (Violeta Tracejado) */}
          <Path d={forecastPath} fill="none" stroke="#a855f7" strokeWidth="2.2" strokeDasharray="4 4" />

          {/* Círculo do ponto de transição (Glicose Atual) */}
          <Circle cx={getX(recentReal.length - 1)} cy={getY(latestGlucose)} r="4" fill="#a855f7" />

          {/* Linha divisória de tempo */}
          <Line x1={getX(recentReal.length - 1)} y1={paddingTop} x2={getX(recentReal.length - 1)} y2={paddingTop + drawableHeight} stroke="rgba(148, 163, 184, 0.25)" strokeWidth="1" strokeDasharray="2 2" />

          {/* Rótulos Eixo X */}
          <SvgText x={paddingLeft} y={graphHeight - 4} fontSize="8" fill={isDarkTheme ? '#64748b' : '#94a3b8'} textAnchor="start">há 2.5h</SvgText>
          <SvgText x={getX(recentReal.length - 1)} y={graphHeight - 4} fontSize="8.5" fill="#a855f7" textAnchor="middle" fontWeight="bold">AGORA ({latestGlucose})</SvgText>
          <SvgText x={graphWidth - paddingRight} y={graphHeight - 4} fontSize="8" fill={isDarkTheme ? '#64748b' : '#94a3b8'} textAnchor="end">+90 min ({predictions[predictions.length-1].val})</SvgText>
        </Svg>
        {/* Legenda do Gráfico de Projeção */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 12, marginTop: 10, paddingHorizontal: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#0d9488' }} />
            <Text style={{ fontSize: 11 * fontScale, color: isDarkTheme ? '#f1f5f9' : '#1e293b', fontWeight: '700' }}>Histórico Real</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 1.5, backgroundColor: '#a855f7', borderWidth: 0.5, borderStyle: 'dashed' }} />
            <Text style={{ fontSize: 11 * fontScale, color: isDarkTheme ? '#f1f5f9' : '#1e293b', fontWeight: '700' }}>Projeção 90m (IOB/COB)</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#a855f7' }} />
            <Text style={{ fontSize: 11 * fontScale, color: isDarkTheme ? '#f1f5f9' : '#1e293b', fontWeight: '700' }}>Leitura Atual</Text>
          </View>
        </View>
      </View>
    );
  };

  // 4. Gráfico SVG de Taxa Basal Programada (stepped-line)
  const renderBasalChart = () => {
    const basalList = getBasalArray();
    if (basalList.length === 0) {
      return (
        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
          <Text style={[styles.sectionDesc, stylesTheme.textSec, { textAlign: 'center', fontSize: 11 * fontScale }]}>
            Perfil de basal programado indisponível no Nightscout.
          </Text>
        </View>
      );
    }

    const graphWidth = screenWidth - 32;
    const graphHeight = 110;
    const paddingLeft = 30;
    const paddingRight = 10;
    const paddingTop = 10;
    const paddingBottom = 20;

    const drawableWidth = graphWidth - paddingLeft - paddingRight;
    const drawableHeight = graphHeight - paddingTop - paddingBottom;

    const parseTimeToMinutes = (tStr: string) => {
      const parts = tStr.split(':');
      const h = Number(parts[0]) || 0;
      const m = Number(parts[1]) || 0;
      return h * 60 + m;
    };

    const sortedBasal = [...basalList].sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));
    const rawPoints = sortedBasal.map(b => ({
      min: parseTimeToMinutes(b.time),
      val: b.value
    }));

    if (rawPoints[0].min !== 0) {
      rawPoints.unshift({ min: 0, val: rawPoints[rawPoints.length - 1].val });
    }
    rawPoints.push({ min: 1440, val: rawPoints[rawPoints.length - 1].val });

    const values = rawPoints.map(p => p.val);
    const maxVal = Math.max(...values, 1.0);
    const minVal = 0;

    let pathD = '';
    let fillD = '';

    const getX = (min: number) => paddingLeft + (min / 1440) * drawableWidth;
    const getY = (val: number) => {
      const ratio = (val - minVal) / (maxVal - minVal);
      return paddingTop + drawableHeight * (1 - ratio);
    };

    if (rawPoints.length > 0) {
      const startX = getX(rawPoints[0].min);
      const startY = getY(rawPoints[0].val);
      pathD = `M ${startX} ${startY}`;
      fillD = `M ${startX} ${paddingTop + drawableHeight} L ${startX} ${startY}`;

      for (let i = 0; i < rawPoints.length - 1; i++) {
        const pCurrent = rawPoints[i];
        const pNext = rawPoints[i + 1];
        const xNext = getX(pNext.min);
        const yNext = getY(pNext.val);

        pathD += ` L ${xNext} ${getY(pCurrent.val)} L ${xNext} ${yNext}`;
        fillD += ` L ${xNext} ${getY(pCurrent.val)} L ${xNext} ${yNext}`;
      }

      fillD += ` L ${getX(1440)} ${paddingTop + drawableHeight} Z`;
    }

    return (
      <View style={styles.chartContainer}>
        <Svg width={graphWidth} height={graphHeight}>
          <Defs>
            <LinearGradient id="basalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <Stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </LinearGradient>
          </Defs>

          <Line x1={paddingLeft} y1={getY(maxVal)} x2={graphWidth - paddingRight} y2={getY(maxVal)} stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'} strokeWidth="1" />
          <Line x1={paddingLeft} y1={getY(maxVal / 2)} x2={graphWidth - paddingRight} y2={getY(maxVal / 2)} stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'} strokeWidth="1" strokeDasharray="3 3" />
          <Line x1={paddingLeft} y1={paddingTop + drawableHeight} x2={graphWidth - paddingRight} y2={paddingTop + drawableHeight} stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} strokeWidth="1.2" />

          {/* Rótulos Y */}
          <SvgText x={paddingLeft - 6} y={getY(maxVal) + 3} fontSize="8" fill={isDark ? '#94a3b8' : '#64748b'} textAnchor="end">{maxVal.toFixed(2)}</SvgText>
          <SvgText x={paddingLeft - 6} y={getY(maxVal / 2) + 3} fontSize="8" fill={isDark ? '#64748b' : '#94a3b8'} textAnchor="end">{(maxVal / 2).toFixed(2)}</SvgText>

          {/* Preenchimento e curvas */}
          {fillD !== '' && <Path d={fillD} fill="url(#basalGrad)" />}
          {pathD !== '' && <Path d={pathD} fill="none" stroke="#10b981" strokeWidth="2.2" />}

          {/* Rótulos X */}
          {['00h', '06h', '12h', '18h', '24h'].map((label, idx) => {
            const min = idx * 360;
            return (
              <SvgText key={idx} x={getX(min)} y={graphHeight - 4} fontSize="8" fill={isDark ? '#64748b' : '#94a3b8'} textAnchor={idx === 0 ? 'start' : idx === 4 ? 'end' : 'middle'}>
                {label}
              </SvgText>
            );
          })}
        </Svg>
        {/* Legenda do Perfil Basal */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#10b981' }} />
            <Text style={{ fontSize: 11 * fontScale, color: isDark ? '#f1f5f9' : '#1e293b', fontWeight: '700' }}>Taxa Basal Programada (U/h)</Text>
          </View>
        </View>
      </View>
    );
  };

  const getHeatmapColor = (val: number) => {
    if (val === 0) return isDarkTheme ? 'rgba(30, 41, 59, 0.25)' : 'rgba(203, 213, 225, 0.35)';
    if (val < 70) return 'rgba(239, 68, 68, 0.65)';
    if (val <= 180) return 'rgba(13, 148, 136, 0.65)';
    if (val <= 250) return 'rgba(249, 115, 22, 0.65)';
    return 'rgba(217, 70, 239, 0.75)';
  };


  const renderDailyTirChart = () => {
    if (dailyStats.length === 0) return null;

    const graphWidth = screenWidth - 32;
    const graphHeight = 120;
    const paddingLeft = 10;
    const paddingRight = 10;
    const paddingTop = 10;
    const paddingBottom = 20;

    const drawableWidth = graphWidth - paddingLeft - paddingRight;
    const drawableHeight = graphHeight - paddingTop - paddingBottom;
    const barWidth = Math.max(4, (drawableWidth / dailyStats.length) * 0.6);

    return (
      <View style={styles.chartContainer}>
        <Svg width={graphWidth} height={graphHeight}>
          {/* Linhas de grade 50% e 100% */}
          <Line x1={paddingLeft} y1={paddingTop} x2={graphWidth - paddingRight} y2={paddingTop} stroke={isDarkTheme ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} strokeWidth="1" strokeDasharray="2 2" />
          <Line x1={paddingLeft} y1={paddingTop + drawableHeight / 2} x2={graphWidth - paddingRight} y2={paddingTop + drawableHeight / 2} stroke={isDarkTheme ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} strokeWidth="1" strokeDasharray="2 2" />
          <Line x1={paddingLeft} y1={paddingTop + drawableHeight} x2={graphWidth - paddingRight} y2={paddingTop + drawableHeight} stroke={isDarkTheme ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} strokeWidth="1" />

          {dailyStats.map((stat, idx) => {
            const x = paddingLeft + (idx / Math.max(1, dailyStats.length - 1)) * (drawableWidth - barWidth);
            const hasData = stat.hasData !== false && stat.tir !== null;
            const tirRatio = hasData ? (stat.tir / 100) : 0;
            const barHeight = drawableHeight * tirRatio;
            const y = paddingTop + drawableHeight - barHeight;

            // Background da barra (vermelho se tem dados, cinza se não tem sinal)
            const bgFill = hasData 
              ? (isDarkTheme ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)') 
              : (isDarkTheme ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.08)');

            return (
              <G key={idx}>
                {/* Background da barra */}
                <Path d={`M ${x} ${paddingTop} L ${x + barWidth} ${paddingTop} L ${x + barWidth} ${paddingTop + drawableHeight} L ${x} ${paddingTop + drawableHeight} Z`} fill={bgFill} />
                {/* Barra do TIR (verde) */}
                {hasData && (
                  <Path d={`M ${x} ${y} L ${x + barWidth} ${y} L ${x + barWidth} ${paddingTop + drawableHeight} L ${x} ${paddingTop + drawableHeight} Z`} fill="#0d9488" />
                )}
                
                {/* Rótulo de Data a cada ~3-4 barras dependendo do tamanho */}
                {(dailyStats.length <= 14 || idx % Math.ceil(dailyStats.length / 5) === 0) && (
                  <SvgText x={x + barWidth / 2} y={graphHeight - 4} fontSize="8" fill={isDarkTheme ? '#64748b' : '#94a3b8'} textAnchor="middle">
                    {stat.dateStr}
                  </SvgText>
                )}
              </G>
            );
          })}
        </Svg>
        {/* Legenda do TIR Diário */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#0d9488' }} />
            <Text style={{ fontSize: 11 * fontScale, color: isDarkTheme ? '#f1f5f9' : '#1e293b', fontWeight: '700' }}>Tempo na Faixa Alvo (TIR)</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: isDarkTheme ? 'rgba(239, 68, 68, 0.45)' : 'rgba(239, 68, 68, 0.25)', borderWidth: 1, borderColor: '#ef4444' }} />
            <Text style={{ fontSize: 11 * fontScale, color: isDarkTheme ? '#f1f5f9' : '#1e293b', fontWeight: '700' }}>{"Fora do Alvo (<70 ou >180)"}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderHourlyTirChart = () => {
    if (hourlyTir.length === 0) return null;

    const graphWidth = screenWidth - 32;
    const graphHeight = 120;
    const paddingLeft = 20;
    const paddingRight = 10;
    const paddingTop = 10;
    const paddingBottom = 20;

    const drawableWidth = graphWidth - paddingLeft - paddingRight;
    const drawableHeight = graphHeight - paddingTop - paddingBottom;

    const getX = (hour: number) => paddingLeft + (hour / 23) * drawableWidth;
    const getY = (val: number) => paddingTop + drawableHeight * (1 - (val / 100));

    let pathD = `M ${getX(0)} ${getY(hourlyTir[0])}`;
    let fillD = `M ${getX(0)} ${paddingTop + drawableHeight} L ${getX(0)} ${getY(hourlyTir[0])}`;

    for (let i = 1; i < 24; i++) {
      pathD += ` L ${getX(i)} ${getY(hourlyTir[i])}`;
      fillD += ` L ${getX(i)} ${getY(hourlyTir[i])}`;
    }
    fillD += ` L ${getX(23)} ${paddingTop + drawableHeight} Z`;

    return (
      <View style={styles.chartContainer}>
        <Svg width={graphWidth} height={graphHeight}>
          <Defs>
            <LinearGradient id="tirGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.4" />
              <Stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.0" />
            </LinearGradient>
          </Defs>

          <Line x1={paddingLeft} y1={paddingTop} x2={graphWidth - paddingRight} y2={paddingTop} stroke={isDarkTheme ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} strokeWidth="1" strokeDasharray="2 2" />
          <Line x1={paddingLeft} y1={paddingTop + drawableHeight / 2} x2={graphWidth - paddingRight} y2={paddingTop + drawableHeight / 2} stroke={isDarkTheme ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} strokeWidth="1" strokeDasharray="2 2" />
          <Line x1={paddingLeft} y1={paddingTop + drawableHeight} x2={graphWidth - paddingRight} y2={paddingTop + drawableHeight} stroke={isDarkTheme ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} strokeWidth="1" />

          <SvgText x={paddingLeft - 4} y={paddingTop + 3} fontSize="8" fill={isDarkTheme ? '#94a3b8' : '#64748b'} textAnchor="end">100%</SvgText>
          <SvgText x={paddingLeft - 4} y={paddingTop + drawableHeight / 2 + 3} fontSize="8" fill={isDarkTheme ? '#94a3b8' : '#64748b'} textAnchor="end">50%</SvgText>

          {fillD !== '' && <Path d={fillD} fill="url(#tirGrad)" />}
          {pathD !== '' && <Path d={pathD} fill="none" stroke="#0ea5e9" strokeWidth="2.2" />}

          {[0, 6, 12, 18, 23].map((hour) => (
            <SvgText key={hour} x={getX(hour)} y={graphHeight - 4} fontSize="8" fill={isDarkTheme ? '#64748b' : '#94a3b8'} textAnchor={hour === 0 ? 'start' : hour === 23 ? 'end' : 'middle'}>
              {hour}h
            </SvgText>
          ))}
        </Svg>
        {/* Legenda do TIR Horário */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#0ea5e9' }} />
            <Text style={{ fontSize: 11 * fontScale, color: isDarkTheme ? '#f1f5f9' : '#1e293b', fontWeight: '700' }}>Média de Tempo na Faixa Alvo (%)</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderDailyStatsTable = () => {
    if (dailyStats.length === 0) return null;

    return (
      <View style={[styles.sectionCard, stylesTheme.card]}>
        <Text style={[styles.sectionTitle, stylesTheme.text, { fontSize: 13 * fontScale }]}>
          📅 Tabela de Estatísticas Diárias
        </Text>
        <Text style={[styles.sectionDesc, stylesTheme.textSec, { fontSize: 9.5 * fontScale }]}>
          Resumo consolidado por dia (Média, TIR e Variabilidade).
        </Text>
        <View style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: isDarkTheme ? '#334155' : '#cbd5e1', paddingBottom: 8, marginBottom: 8 }}>
            <Text style={{ flex: 1, fontWeight: 'bold', color: stylesTheme.text.color, fontSize: 10 * fontScale }}>Data</Text>
            <Text style={{ flex: 1, fontWeight: 'bold', color: stylesTheme.text.color, textAlign: 'center', fontSize: 10 * fontScale }}>Média</Text>
            <Text style={{ flex: 1, fontWeight: 'bold', color: stylesTheme.text.color, textAlign: 'center', fontSize: 10 * fontScale }}>TIR (%)</Text>
            <Text style={{ flex: 1, fontWeight: 'bold', color: stylesTheme.text.color, textAlign: 'right', fontSize: 10 * fontScale }}>SD</Text>
          </View>
          {dailyStats.slice().reverse().map((stat, idx) => {
            const hasData = stat.hasData !== false && stat.avg !== null;
            return (
              <View key={idx} style={{ flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: isDarkTheme ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                <Text style={{ flex: 1, color: stylesTheme.textSec.color, fontSize: 11 * fontScale }}>{stat.dateStr}</Text>
                <Text style={{ 
                  flex: 1, 
                  color: hasData ? (stat.avg > 180 ? '#f97316' : stat.avg < 70 ? '#ef4444' : '#0d9488') : stylesTheme.textSec.color, 
                  textAlign: 'center', 
                  fontWeight: hasData ? 'bold' : 'normal', 
                  fontSize: 11 * fontScale 
                }}>
                  {hasData ? stat.avg : '-'}
                </Text>
                <Text style={{ 
                  flex: 1, 
                  color: hasData ? (stat.tir >= 70 ? '#0d9488' : '#f97316') : stylesTheme.textSec.color, 
                  textAlign: 'center', 
                  fontWeight: hasData ? 'bold' : 'normal', 
                  fontSize: 11 * fontScale 
                }}>
                  {hasData ? `${stat.tir}%` : '-'}
                </Text>
                <Text style={{ flex: 1, color: stylesTheme.textSec.color, textAlign: 'right', fontSize: 11 * fontScale }}>
                  {hasData ? stat.sd : '-'}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

    // Renderização da Aba de Relatório
  const renderReportTab = () => {
    return (
      <View style={{ gap: 16 }}>
        {/* Botão de Exportar PDF Premium */}
        <View style={[styles.sectionCard, stylesTheme.card, { padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center' }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, stylesTheme.text, { fontSize: 13 * fontScale }]}>
              📄 Relatório Médico Completo (PDF)
            </Text>
            <Text style={[styles.sectionDesc, stylesTheme.textSec, { fontSize: 9.5 * fontScale }]}>
              Gere o relatório formatado com insights e gráficos e compartilhe direto no WhatsApp.
            </Text>
          </View>
          <Pressable
            onPress={exportReportToPdf}
            disabled={exportingPdf}
            style={({ pressed }) => [
              { backgroundColor: '#0d9488', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
              pressed && { opacity: 0.85 }
            ]}
          >
            {exportingPdf ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 11 * fontScale }}>COMPARTILHAR</Text>
            )}
          </Pressable>
        </View>

        {/* Seletor de Dias */}
        <View style={[styles.sectionCard, stylesTheme.card]}>
          <Text style={[styles.sectionTitle, stylesTheme.text, { fontSize: 12 * fontScale, marginBottom: 8 }]}>
            📆 Período de Análise
          </Text>
          <View style={styles.periodSelectorContainer}>
            {[1, 3, 7, 14, 30].map(days => (
              <Pressable
                key={days}
                onPress={() => {
                  setSelectedDays(days);
                  fetchReportData(days);
                }}
                style={({ pressed }) => [
                  styles.periodButton,
                  selectedDays === days && {
                    backgroundColor: isDark ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.12)',
                    borderColor: '#4f46e5',
                    borderWidth: 1.5,
                  },
                  pressed && { opacity: 0.85 }
                ]}
              >
                <Text style={[
                  styles.periodButtonText,
                  {
                    color: selectedDays === days ? '#4f46e5' : isDark ? '#94a3b8' : '#64748b',
                    fontWeight: selectedDays === days ? '900' : '600',
                    fontSize: 11 * fontScale
                  }
                ]}>
                  {days} {days === 1 ? 'Dia' : 'Dias'}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => {
                setCustomDaysInput('');
                setIsCustomDaysModalOpen(true);
              }}
              style={({ pressed }) => [
                styles.periodButton,
                ![1, 3, 7, 14, 30].includes(selectedDays) && {
                  backgroundColor: isDark ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.12)',
                  borderColor: '#4f46e5',
                  borderWidth: 1.5,
                },
                pressed && { opacity: 0.85 }
              ]}
            >
              <Text style={[
                styles.periodButtonText,
                {
                  color: ![1, 3, 7, 14, 30].includes(selectedDays) ? '#4f46e5' : isDark ? '#94a3b8' : '#64748b',
                  fontWeight: ![1, 3, 7, 14, 30].includes(selectedDays) ? '900' : '600',
                  fontSize: 11 * fontScale
                }
              ]}>
                {![1, 3, 7, 14, 30].includes(selectedDays) ? `${selectedDays}d` : 'Outro'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Modal para Período Personalizado */}
        <Modal
          visible={isCustomDaysModalOpen}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setIsCustomDaysModalOpen(false)}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center' }]}>
              <ScrollView
                contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', width: '100%' }}
                keyboardShouldPersistTaps="handled"
              >
                <View style={[styles.modalContent, stylesTheme.modalContent, { width: '80%', maxWidth: 320, borderRadius: 28, borderTopLeftRadius: 28, borderTopRightRadius: 28 }]}>
                  <Text style={[styles.modalTitle, stylesTheme.text, { fontSize: 14 * fontScale }]}>
                    Período Personalizado
                  </Text>
                  <Text style={[{ color: isDark ? '#94a3b8' : '#64748b', fontSize: 10.5 * fontScale, marginBottom: 12 }]}>
                    Informe o número de dias que deseja analisar (máx. 90 dias).
                  </Text>
                  <TextInput
                    style={[styles.input, stylesTheme.input, { fontSize: 18 * fontScale, textAlign: 'center', height: 50 }]}
                    keyboardType="numeric"
                    placeholder="Ex: 5"
                    placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                    value={customDaysInput}
                    onChangeText={setCustomDaysInput}
                    autoFocus={true}
                    maxLength={3}
                  />
                  <View style={[styles.modalButtons, { marginTop: 16 }]}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.modalButton, styles.cancelButton,
                        pressed && { opacity: 0.7 }
                      ]}
                      onPress={() => setIsCustomDaysModalOpen(false)}
                    >
                      <Text style={[styles.cancelButtonText, { fontSize: 11 * fontScale }]}>CANCELAR</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.modalButton, styles.saveButton,
                        pressed && { opacity: 0.8 }
                      ]}
                      onPress={() => {
                        const d = parseInt(customDaysInput);
                        if (!d || d < 1 || d > 90) {
                          Alert.alert('Aviso', 'Informe um valor entre 1 e 90 dias.');
                          return;
                        }
                        setSelectedDays(d);
                        fetchReportData(d);
                        setIsCustomDaysModalOpen(false);
                      }}
                    >
                      <Text style={[styles.saveButtonText, { fontSize: 11 * fontScale }] as any}>APLICAR</Text>
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Grade de Métricas */}
        <View style={styles.metricsGrid}>
          <View style={[styles.metricCard, stylesTheme.card]}>
            <Text style={[styles.metricLabel, stylesTheme.textSec, { fontSize: 9 * fontScale }]}>Glicose Média</Text>
            <Text style={[styles.metricValue, { color: avgGlucose >= 70 && avgGlucose <= 180 ? '#0d9488' : avgGlucose > 180 ? '#f97316' : '#ef4444', fontSize: 22 * fontScale }]}>
              {avgGlucose}
            </Text>
            <Text style={[styles.metricUnit, stylesTheme.textSec, { fontSize: 7.5 * fontScale }]}>mg/dL</Text>
          </View>

          <View style={[styles.metricCard, stylesTheme.card]}>
            <Text style={[styles.metricLabel, stylesTheme.textSec, { fontSize: 9 * fontScale }]}>Variabilidade</Text>
            <Text style={[styles.metricValue, stylesTheme.text, { fontSize: 22 * fontScale }]}>
              {sdGlucose}
            </Text>
            <Text style={[styles.metricUnit, stylesTheme.textSec, { fontSize: 7.5 * fontScale }]}>mg/dL (SD)</Text>
          </View>

          <View style={[styles.metricCard, stylesTheme.card]}>
            <Text style={[styles.metricLabel, stylesTheme.textSec, { fontSize: 9 * fontScale }]}>eA1C Estimada</Text>
            <Text style={[styles.metricValue, { color: ea1c <= 7.0 ? '#0d9488' : '#f97316', fontSize: 22 * fontScale }]}>
              {ea1c}%
            </Text>
            <Text style={[styles.metricUnit, stylesTheme.textSec, { fontSize: 7.5 * fontScale }]}>padrão ADA</Text>
          </View>
        </View>

        {/* Insights Clínicos Inteligentes */}
        <View style={[styles.sectionCard, stylesTheme.card]}>
          <Text style={[styles.sectionTitle, stylesTheme.text, { fontSize: 13 * fontScale }]}>
            💡 Insights Clínicos Inteligentes
          </Text>
          <Text style={[styles.sectionDesc, stylesTheme.textSec, { fontSize: 9.5 * fontScale, marginBottom: 12 }]}>
            Análise automatizada de padrões glicêmicos no período para ajudar no seu controle diário.
          </Text>
          <View style={{ gap: 10 }}>
            {generateClinicalInsights().map((insight, idx) => {
              const borderColors = {
                success: '#0d9488',
                warning: '#f97316',
                danger: '#ef4444',
                info: '#0ea5e9'
              };
              const bgColors = {
                success: isDark ? 'rgba(13, 148, 136, 0.08)' : 'rgba(13, 148, 136, 0.04)',
                warning: isDark ? 'rgba(249, 115, 22, 0.08)' : 'rgba(249, 115, 22, 0.04)',
                danger: isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.04)',
                info: isDark ? 'rgba(14, 165, 233, 0.08)' : 'rgba(14, 165, 233, 0.04)'
              };

              return (
                <View key={idx} style={{
                  flexDirection: 'row',
                  padding: 12,
                  backgroundColor: bgColors[insight.type],
                  borderLeftWidth: 4,
                  borderLeftColor: borderColors[insight.type],
                  borderRadius: 8,
                  gap: 10,
                  alignItems: 'flex-start'
                }}>
                  <Text style={{ fontSize: 18 }}>{insight.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: stylesTheme.text.color, fontWeight: '800', fontSize: 11.5 * fontScale, marginBottom: 2 }}>
                      {insight.title}
                    </Text>
                    <Text style={{ color: stylesTheme.textSec.color, fontSize: 10 * fontScale, lineHeight: 14 }}>
                      {insight.message}
                    </Text>
                  </View>
                </View>
              );
            })}
            {generateClinicalInsights().length === 0 && (
              <Text style={{ color: stylesTheme.textSec.color, fontStyle: 'italic', fontSize: 11 * fontScale, textAlign: 'center', paddingVertical: 10 }}>
                Sem dados suficientes para gerar insights.
              </Text>
            )}
          </View>
        </View>

        {/* Gráfico de Evolução */}
        <View style={[styles.sectionCard, stylesTheme.card]}>
          <Text style={[styles.sectionTitle, stylesTheme.text, { fontSize: 13 * fontScale }]}>
            📈 Perfil de Glicemia ({selectedDays} {selectedDays === 1 ? 'dia' : 'dias'})
          </Text>
          <Text style={[styles.sectionDesc, stylesTheme.textSec, { fontSize: 9.5 * fontScale }]}>
            Histórico contínuo e estabilidade de glicemia do sensor no período.
          </Text>
          {renderLineChart()}
        </View>

        {/* Time in Range */}
        <View style={[styles.sectionCard, stylesTheme.card]}>
          <Text style={[styles.sectionTitle, stylesTheme.text, { fontSize: 13 * fontScale }]}>
            🎯 Tempo na Faixa (Time in Range)
          </Text>
          <Text style={[styles.sectionDesc, stylesTheme.textSec, { fontSize: 12 * fontScale, color: isDark ? '#cbd5e1' : '#475569', lineHeight: 16 }]}>
            Porcentagem das leituras de glicemia dentro dos alvos clínicos ideais.
          </Text>

          <View style={styles.tirRow}>
            {renderDonutChart()}

            <View style={styles.tirLegendContainer}>
              <View style={styles.legendItem}>
                <View style={[styles.legendIndicator, { backgroundColor: '#d946ef' }]} />
                <Text style={[styles.legendLabel, stylesTheme.text, { fontSize: 12.5 * fontScale, fontWeight: '600' }]}>Muito Alto (&gt;250):</Text>
                <Text style={[styles.legendValue, stylesTheme.text, { fontSize: 13.5 * fontScale, fontWeight: '700' }]}>{tirPercentages.veryHigh}%</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendIndicator, { backgroundColor: '#f97316' }]} />
                <Text style={[styles.legendLabel, stylesTheme.text, { fontSize: 12.5 * fontScale, fontWeight: '600' }]}>Alto (181-250):</Text>
                <Text style={[styles.legendValue, stylesTheme.text, { fontSize: 13.5 * fontScale, fontWeight: '700' }]}>{tirPercentages.high}%</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendIndicator, { backgroundColor: '#0d9488' }]} />
                <Text style={[styles.legendLabel, stylesTheme.text, { fontSize: 12.5 * fontScale, fontWeight: '800' }]}>Ideal (70-180):</Text>
                <Text style={[styles.legendValue, stylesTheme.text, { fontSize: 13.5 * fontScale, fontWeight: '900' }]}>{tirPercentages.inRange}%</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendIndicator, { backgroundColor: '#f87171' }]} />
                <Text style={[styles.legendLabel, stylesTheme.text, { fontSize: 12.5 * fontScale, fontWeight: '600' }]}>Baixo (54-69):</Text>
                <Text style={[styles.legendValue, stylesTheme.text, { fontSize: 13.5 * fontScale, fontWeight: '700' }]}>{tirPercentages.low}%</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendIndicator, { backgroundColor: '#ef4444' }]} />
                <Text style={[styles.legendLabel, stylesTheme.text, { fontSize: 12.5 * fontScale, fontWeight: '600' }]}>Muito Baixo (&lt;54):</Text>
                <Text style={[styles.legendValue, stylesTheme.text, { fontSize: 13.5 * fontScale, fontWeight: '700' }]}>{tirPercentages.veryLow}%</Text>
              </View>
            </View>
          </View>
          {/* Nota clínica explicativa das metas de TIR */}
          <Text style={{ fontSize: 11 * fontScale, color: isDark ? '#94a3b8' : '#475569', textAlign: 'center', marginTop: 12, fontStyle: 'italic', paddingHorizontal: 12, lineHeight: 16 }}>
            {"* Alvo clínico internacional recomendado: Manter o tempo na faixa ideal (70-180 mg/dL) acima de 70% e episódios de hipoglicemia grave (<54 mg/dL) abaixo de 1% do tempo total."}
          </Text>
        </View>

        {/* Heatmap */}
        <View style={[styles.sectionCard, stylesTheme.card]}>
          <Text style={[styles.sectionTitle, stylesTheme.text, { fontSize: 13 * fontScale }]}>
            🔥 AGP 24H (Mapa de Calor)
          </Text>
          <Text style={[styles.sectionDesc, stylesTheme.textSec, { fontSize: 9.5 * fontScale }]}>
            Padrões horários e semanais das leituras (Arraste para o lado para ver 24h).
          </Text>

          <ScrollView horizontal={true} showsHorizontalScrollIndicator={true} style={styles.heatmapScroll}>
            <View style={styles.heatmapContainer}>
              <View style={styles.heatmapHeaderRow}>
                <View style={styles.heatmapDayLabelPlaceholder} />
                {Array(24).fill(null).map((_, i) => (
                  <Text key={i} style={[styles.heatmapHourLabel, stylesTheme.textSec, { fontSize: 8 }]}>
                    {i}h
                  </Text>
                ))}
              </View>

              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dayName, dayIndex) => (
                <View key={dayIndex} style={styles.heatmapRow}>
                  <Text style={[styles.heatmapDayLabel, stylesTheme.text, { fontSize: 9.5 * fontScale }]}>
                    {dayName}
                  </Text>
                  {Array(24).fill(null).map((_, hourIndex) => {
                    const val = heatmapMatrix[dayIndex][hourIndex];
                    return (
                      <View
                        key={hourIndex}
                        style={[
                          styles.heatmapCell,
                          { backgroundColor: getHeatmapColor(val) }
                        ]}
                      >
                        {val > 0 && (
                          <Text style={styles.heatmapCellValue}>
                            {val}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={styles.heatmapLegend}>
            <View style={styles.heatmapLegendItem}>
              <View style={[styles.heatmapLegendBox, { backgroundColor: getHeatmapColor(0) }]} />
              <Text style={[styles.heatmapLegendText, stylesTheme.textSec, { fontSize: 8 * fontScale }]}>Sem sinal</Text>
            </View>
            <View style={styles.heatmapLegendItem}>
              <View style={[styles.heatmapLegendBox, { backgroundColor: getHeatmapColor(60) }]} />
              <Text style={[styles.heatmapLegendText, stylesTheme.textSec, { fontSize: 8 * fontScale }]}>Hipo</Text>
            </View>
            <View style={styles.heatmapLegendItem}>
              <View style={[styles.heatmapLegendBox, { backgroundColor: getHeatmapColor(120) }]} />
              <Text style={[styles.heatmapLegendText, stylesTheme.textSec, { fontSize: 8 * fontScale }]}>Ideal</Text>
            </View>
            <View style={styles.heatmapLegendItem}>
              <View style={[styles.heatmapLegendBox, { backgroundColor: getHeatmapColor(200) }]} />
              <Text style={[styles.heatmapLegendText, stylesTheme.textSec, { fontSize: 8 * fontScale }]}>Alto</Text>
            </View>
            <View style={styles.heatmapLegendItem}>
              <View style={[styles.heatmapLegendBox, { backgroundColor: getHeatmapColor(300) }]} />
              <Text style={[styles.heatmapLegendText, stylesTheme.textSec, { fontSize: 8 * fontScale }]}>Hiper</Text>
            </View>
          </View>
        </View>
        {/* Novos Graficos de TIR Diário e Horário */}
        <View style={[styles.sectionCard, stylesTheme.card]}>
          <Text style={[styles.sectionTitle, stylesTheme.text, { fontSize: 13 * fontScale }]}>
            📊 Histórico Diário de Tempo no Alvo
          </Text>
          <Text style={[styles.sectionDesc, stylesTheme.textSec, { fontSize: 9.5 * fontScale }]}>
            Percentual de glicemia na faixa alvo ao longo dos dias.
          </Text>
          {renderDailyTirChart()}
        </View>

        <View style={[styles.sectionCard, stylesTheme.card]}>
          <Text style={[styles.sectionTitle, stylesTheme.text, { fontSize: 13 * fontScale }]}>
            ⏱️ Distribuição Horária de Tempo no Alvo
          </Text>
          <Text style={[styles.sectionDesc, stylesTheme.textSec, { fontSize: 9.5 * fontScale }]}>
            Média percentual do TIR para cada hora do dia.
          </Text>
          {renderHourlyTirChart()}
        </View>

        {renderDailyStatsTable()}
      </View>
    );
  };  // Renderização da Aba de Status
  const renderAssistantTab = () => {
    const { iob, cob, basalText } = getMetabolicData();
    const { isf, cr } = getProfileParams();
    let sensorAgeText = 'Não informado';
    let sensorStyle = styles.statusGreen;
    let isSensorWarning = false;

    let cannulaAgeText = 'Não informado';
    let cannulaStyle = styles.statusGreen;
    let isCannulaWarning = false;

    let loopStateText = 'Sem informações';
    let loopStyle = styles.statusSlate;
    let loopReasonText = 'Sem dados do loop no devicestatus recente.';
    let batteryText = 'N/A';
    let batteryVal = 100;

    // Processar propriedades v2
    if (properties) {
      // Sensor age (SAGE)
      const sage = properties.sage || {};
      const minKey = sage.min;
      if (minKey && properties.sage[minKey] && properties.sage[minKey].found) {
        const ageHours = properties.sage[minKey].age;
        if (ageHours !== undefined) {
          const days = (ageHours / 24).toFixed(1);
          sensorAgeText = `${days} dias`;
          if (Number(days) >= 9.5) {
            sensorStyle = styles.statusRed;
            isSensorWarning = true;
          } else if (Number(days) >= 8.0) {
            sensorStyle = styles.statusOrange;
          }
        }
      }

      // Cannula/Cateter age (CAGE)
      const cage = properties.cage || {};
      if (cage.found && cage.age !== undefined) {
        const days = (cage.age / 24).toFixed(1);
        cannulaAgeText = `${days} dias`;
        if (Number(days) >= 3.0) {
          cannulaStyle = styles.statusRed;
          isCannulaWarning = true;
        } else if (Number(days) >= 2.5) {
          cannulaStyle = styles.statusOrange;
        }
      }
    }

    // Processar devicestatus e Loop
    if (deviceStatus && deviceStatus.length > 0) {
      const ds = deviceStatus[0];
      
      // Bateria do celular transmissor
      if (ds.uploader && ds.uploader.battery !== undefined) {
        batteryVal = ds.uploader.battery;
        batteryText = `${batteryVal}%`;
      }

      // Loop status
      const loop = ds.loop || ds.openaps || null;
      if (loop) {
        const enacted = loop.enacted || loop.suggested || null;
        if (enacted) {
          loopStateText = 'Loop Ativo';
          loopStyle = styles.statusGreen;
          loopReasonText = translateLoopReason(enacted.reason || '');
        } else {
          loopStateText = 'Loop Inativo / Monitorando';
          loopStyle = styles.statusOrange;
          loopReasonText = 'Loop conectado, mas nenhuma alteração basal enviada recente.';
        }
      }
    }

    const latestEntry = entries.length > 0 ? entries[entries.length - 1] : null;
    const currentSgv = latestEntry ? latestEntry.sgv : 0;
    const currentDirection = latestEntry ? latestEntry.direction : 'Flat';
    const currentDate = latestEntry ? latestEntry.date : 0;

    const getGlucoseStatusDetails = (val: number) => {
      if (val <= 0) return { label: 'SEM SINAL', color: '#64748b', bg: isDark ? 'rgba(30, 41, 59, 0.45)' : '#f1f5f9' };
      if (val < 70) return { label: 'HIPOGLICEMIA', color: '#ef4444', bg: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)' };
      if (val <= 180) return { label: 'NORMAL', color: '#0d9488', bg: isDark ? 'rgba(13, 148, 136, 0.15)' : 'rgba(13, 148, 136, 0.08)' };
      return { label: 'HIPERGLICEMIA', color: '#f97316', bg: isDark ? 'rgba(249, 115, 22, 0.15)' : 'rgba(249, 115, 22, 0.08)' };
    };

    const getTrendIcon = (dir: string) => {
      switch (dir) {
        case 'DoubleUp': return '⇈';
        case 'SingleUp': return '↑';
        case 'FortyFiveUp': return '↗';
        case 'Flat': return '→';
        case 'FortyFiveDown': return '↘';
        case 'SingleDown': return '↓';
        case 'DoubleDown': return '⇊';
        default: return '→';
      }
    };

    return (
      <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 40 }}>
        {/* 1. Gráfico de Projeção */}
        <View style={[styles.sectionCard, stylesTheme.card]}>
          <Text style={[styles.sectionTitle, stylesTheme.text, { fontSize: 13 * fontScale }]}>
            🔮 Projeção Metabólica de Glicemia
          </Text>
          <Text style={[styles.sectionDesc, stylesTheme.textSec, { fontSize: 9.5 * fontScale }]}>
            Previsão matemática de 90 minutos usando a tendência amortecida, COB e IOB decrescentes.
          </Text>
          {renderForecastChart()}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 10, height: 2, backgroundColor: '#0d9488' }} />
              <Text style={{ fontSize: 8.5, color: isDark ? '#94a3b8' : '#64748b' }}>Glicose Real</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 10, height: 2, backgroundColor: '#a855f7', borderWidth: 0.5, borderStyle: 'dashed' }} />
              <Text style={{ fontSize: 8.5, color: isDark ? '#94a3b8' : '#64748b' }}>Projeção 90m</Text>
            </View>
          </View>
        </View>

        {/* Botão Acessar Nightscout do Diabético */}
        <Pressable
          style={({ pressed }) => [
            {
              backgroundColor: isDark ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.08)',
              borderColor: isDark ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.15)',
              borderWidth: 1.5,
              borderRadius: 14,
              paddingVertical: 12,
              paddingHorizontal: 16,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
              opacity: pressed ? 0.75 : 1,
            }
          ]}
          onPress={() => {
            if (url) {
              Linking.openURL(url).catch(err => {
                console.error("Erro ao abrir URL do Nightscout:", err);
                Alert.alert("Erro", "Não foi possível abrir o Nightscout.");
              });
            } else {
              Alert.alert("Aviso", "URL do Nightscout não disponível.");
            }
          }}
        >
          <Text style={{ fontSize: 14 }}>🚀</Text>
          <Text style={{ color: '#6366f1', fontWeight: '900', fontSize: 11 * fontScale, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Acessar NightScout do Diabético
          </Text>
        </Pressable>

        {/* 2. Card de Glicose Atual Destacado */}
        {latestEntry && (
          <View style={[styles.sectionCard, stylesTheme.card, { alignItems: 'center', paddingVertical: 20 }]}>
            <Text style={[styles.sectionTitle, stylesTheme.text, { fontSize: 13 * fontScale, marginBottom: 8 }]}>
              🩸 Valor Atual da Glicemia
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8 }}>
              <Text style={{ fontSize: 44 * fontScale, fontWeight: '900', color: getGlucoseStatusDetails(currentSgv).color }}>
                {currentSgv}
              </Text>
              <View>
                <Text style={{ fontSize: 24 * fontScale, color: getGlucoseStatusDetails(currentSgv).color, fontWeight: 'bold' }}>
                  {getTrendIcon(currentDirection)}
                </Text>
                <Text style={{ fontSize: 10 * fontScale, color: isDark ? '#94a3b8' : '#64748b', fontWeight: 'bold' }}>
                  mg/dL
                </Text>
              </View>
            </View>
            <View style={{
              backgroundColor: getGlucoseStatusDetails(currentSgv).bg,
              paddingVertical: 4,
              paddingHorizontal: 12,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: getGlucoseStatusDetails(currentSgv).color + '30',
              marginBottom: 8
            }}>
              <Text style={{ color: getGlucoseStatusDetails(currentSgv).color, fontWeight: 'bold', fontSize: 10 * fontScale }}>
                {getGlucoseStatusDetails(currentSgv).label}
              </Text>
            </View>
            <Text style={{ fontSize: 10 * fontScale, color: isDark ? '#475569' : '#94a3b8' }}>
              Atualizado {getMinutesAgo(currentDate)}
            </Text>
          </View>
        )}

        {/* 3. Algoritmo de Loop */}
        <View style={[styles.sectionCard, stylesTheme.card]}>
          <Text style={[styles.sectionTitle, stylesTheme.text, { fontSize: 13 * fontScale, marginBottom: 12 }]}>
            🤖 Loop de Insulina (Pâncreas Artificial)
          </Text>

          {/* Cards de métricas do Loop */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <View style={{
              flex: 1,
              backgroundColor: isDark ? 'rgba(2, 6, 23, 0.5)' : '#f8fafc',
              padding: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0',
              alignItems: 'center'
            }}>
              <Text style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: 8.5 * fontScale, fontWeight: '600', marginBottom: 4 }}>Estado</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[styles.indicatorCircle, { backgroundColor: loopStyle.color, width: 8, height: 8 }]} />
                <Text style={{ color: loopStyle.color, fontWeight: '900', fontSize: 11 * fontScale }}>
                  {loopStateText}
                </Text>
              </View>
            </View>
          </View>

          {/* Decisão do Algoritmo */}
          <View style={{
            backgroundColor: isDark ? 'rgba(2, 6, 23, 0.5)' : '#f8fafc',
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0',
            marginBottom: 12
          }}>
            <Text style={{ color: isDark ? '#64748b' : '#94a3b8', fontSize: 8.5 * fontScale, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 }}>
              ⚙️ Decisão Recente do Algoritmo
            </Text>
            <Text style={{ color: isDark ? '#e2e8f0' : '#1e293b', fontSize: 11 * fontScale, lineHeight: 18 }}>
              {loopReasonText}
            </Text>
          </View>

          {/* IOB / COB inline */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{
              flex: 1,
              backgroundColor: isDark ? 'rgba(79, 70, 229, 0.08)' : 'rgba(79, 70, 229, 0.04)',
              padding: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)',
              alignItems: 'center'
            }}>
              <Text style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: 8 * fontScale, fontWeight: '600' }}>IOB</Text>
              <Text style={{ color: '#818cf8', fontWeight: '900', fontSize: 14 * fontScale }}>{iob.toFixed(2)} U</Text>
            </View>
            <View style={{
              flex: 1,
              backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.04)',
              padding: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)',
              alignItems: 'center'
            }}>
              <Text style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: 8 * fontScale, fontWeight: '600' }}>COB</Text>
              <Text style={{ color: '#fbbf24', fontWeight: '900', fontSize: 14 * fontScale }}>{Math.round(cob)} g</Text>
            </View>
            <View style={{
              flex: 1,
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.04)',
              padding: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
              alignItems: 'center'
            }}>
              <Text style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: 8 * fontScale, fontWeight: '600' }}>Basal</Text>
              <Text style={{ color: '#34d399', fontWeight: '900', fontSize: 14 * fontScale }}>{basalText}</Text>
            </View>
          </View>
        </View>

        {/* 4. Parâmetros Metabólicos Ativos */}
        <View style={[styles.sectionCard, stylesTheme.card]}>
          <Text style={[styles.sectionTitle, stylesTheme.text, { fontSize: 13 * fontScale, marginBottom: 12 }]}>
            🧪 Parâmetros Metabólicos Ativos
          </Text>

          <View style={styles.metabolicsGrid}>
            <View style={styles.metabolicItem}>
              <Text style={[styles.metabolicLabelText, stylesTheme.textSec, { fontSize: 9 * fontScale }]}>Insulina Ativa (IOB)</Text>
              <Text style={[styles.metabolicValText, { color: '#4f46e5', fontSize: 18 * fontScale }]}>{iob.toFixed(2)} U</Text>
            </View>
            <View style={styles.metabolicItem}>
              <Text style={[styles.metabolicLabelText, stylesTheme.textSec, { fontSize: 9 * fontScale }]}>Carbos Ativos (COB)</Text>
              <Text style={[styles.metabolicValText, { color: '#f59e0b', fontSize: 18 * fontScale }]}>{Math.round(cob)} g</Text>
            </View>
            <View style={styles.metabolicItem}>
              <Text style={[styles.metabolicValText, { color: '#10b981', fontSize: 18 * fontScale }]}>{basalText}</Text>
            </View>
          </View>

          <View style={styles.metabolicProfileParams}>
            <Text style={[styles.paramText, stylesTheme.textSec, { fontSize: 10.5 * fontScale }]}>
              Sensibilidade (ISF): <Text style={[styles.paramBold, stylesTheme.text]}>1 U : {isf} mg/dL</Text>
            </Text>
            <Text style={[styles.paramText, stylesTheme.textSec, { fontSize: 10.5 * fontScale }]}>
              Relação de Carbos (CR): <Text style={[styles.paramBold, stylesTheme.text]}>1 U : {cr} g</Text>
            </Text>
          </View>
        </View>

        {/* 5. Sensores e Dispositivos */}
        <View style={[styles.sectionCard, stylesTheme.card]}>
          <Text style={[styles.sectionTitle, stylesTheme.text, { fontSize: 13 * fontScale, marginBottom: 12 }]}>
            📡 Sensores & Trocas Físicas
          </Text>

          <View style={styles.statusGrid}>
            <View style={styles.statusRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusLabel, stylesTheme.textSec, { fontSize: 10 * fontScale }]}>Cateter / Cânula da Bomba (CAGE)</Text>
                <Text style={[styles.statusValue, cannulaStyle, { fontSize: 14 * fontScale }]}>{cannulaAgeText}</Text>
              </View>
              {isCannulaWarning && (
                <Text style={styles.alertPulseText}>⚠️ TROCA RECOMENDADA (&gt;3d)</Text>
              )}
            </View>

            <View style={styles.statusRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusLabel, stylesTheme.textSec, { fontSize: 10 * fontScale }]}>Sensor de Glicose CGM (SAGE)</Text>
                <Text style={[styles.statusValue, sensorStyle, { fontSize: 14 * fontScale }]}>{sensorAgeText}</Text>
              </View>
              {isSensorWarning && (
                <Text style={styles.alertPulseText}>⚠️ TROCAR SENSOR (&gt;10d)</Text>
              )}
            </View>

            <View style={styles.statusRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusLabel, stylesTheme.textSec, { fontSize: 10 * fontScale }]}>Bateria do Transmissor / Uploader</Text>
                <Text style={[styles.statusValue, batteryVal < 20 ? styles.statusRed : styles.statusGreen, { fontSize: 14 * fontScale }]}>
                  {batteryText}
                </Text>
              </View>
              {batteryVal < 20 && (
                <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: 'bold' }}>⚠️ BATERIA FRACA</Text>
              )}
            </View>
          </View>
        </View>

        {/* 6. Informações Gerais do Servidor */}
        <View style={[styles.sectionCard, stylesTheme.card]}>
          <Text style={[styles.sectionTitle, stylesTheme.text, { fontSize: 13 * fontScale, marginBottom: 12 }]}>
            ℹ️ Informações Gerais
          </Text>
          <View style={{ gap: 10 }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: 8,
              borderBottomWidth: 0.5,
              borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'
            }}>
              <Text style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: 10 * fontScale, fontWeight: '600' }}>Paciente</Text>
              <Text style={{ color: isDark ? '#e2e8f0' : '#1e293b', fontSize: 10.5 * fontScale, fontWeight: '700' }}>{name || 'Nightscout'}</Text>
            </View>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: 8,
              borderBottomWidth: 0.5,
              borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'
            }}>
              <Text style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: 10 * fontScale, fontWeight: '600' }}>URL Conectada</Text>
              <Text style={{ color: isDark ? '#e2e8f0' : '#1e293b', fontSize: 10 * fontScale, fontWeight: '600' }} numberOfLines={1}>{url}</Text>
            </View>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: 8,
              borderBottomWidth: 0.5,
              borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'
            }}>
              <Text style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: 10 * fontScale, fontWeight: '600' }}>Status Conexão</Text>
              <Text style={{ color: '#10b981', fontSize: 10.5 * fontScale, fontWeight: '800' }}>ONLINE</Text>
            </View>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: 8,
              borderBottomWidth: 0.5,
              borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'
            }}>
              <Text style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: 10 * fontScale, fontWeight: '600' }}>Leituras no Período</Text>
              <Text style={{ color: isDark ? '#e2e8f0' : '#1e293b', fontSize: 10.5 * fontScale, fontWeight: '700' }}>{entries.length} registros</Text>
            </View>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: 8,
              borderBottomWidth: 0.5,
              borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'
            }}>
              <Text style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: 10 * fontScale, fontWeight: '600' }}>Última Leitura</Text>
              <Text style={{ color: isDark ? '#e2e8f0' : '#1e293b', fontSize: 10.5 * fontScale, fontWeight: '700' }}>
                {entries.length > 0 ? `${entries[entries.length - 1].sgv} mg/dL` : 'N/A'}
              </Text>
            </View>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: 8,
              borderBottomWidth: 0.5,
              borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'
            }}>
              <Text style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: 10 * fontScale, fontWeight: '600' }}>Tratamentos Recentes</Text>
              <Text style={{ color: isDark ? '#e2e8f0' : '#1e293b', fontSize: 10.5 * fontScale, fontWeight: '700' }}>{treatments.length} registros</Text>
            </View>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: 8,
            }}>
              <Text style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: 10 * fontScale, fontWeight: '600' }}>Perfil do Usuário</Text>
              <Text style={{ color: isPro ? '#0ea5e9' : (isDark ? '#e2e8f0' : '#1e293b'), fontSize: 10.5 * fontScale, fontWeight: '800' }}>
                {isPro ? 'PRO' : 'FREE'}
              </Text>
            </View>
          </View>
        </View>

        {/* 7. Perfil Basal Programado */}
        <View style={[styles.sectionCard, stylesTheme.card]}>
          <Text style={[styles.sectionTitle, stylesTheme.text, { fontSize: 13 * fontScale }]}>
            ⏰ Perfil Basal Programado (Basal Profile)
          </Text>
          <Text style={[styles.sectionDesc, stylesTheme.textSec, { fontSize: 9.5 * fontScale }]}>
            Taxas basais por hora configuradas no perfil ativo do Nightscout (00h às 24h).
          </Text>
          {renderBasalChart()}
        </View>
      </ScrollView>
    );
  };

  // renderMetabolicsTab was merged into renderAssistantTab

  
  const handleCalculateBolus = () => {
    const { isf, cr } = getProfileParams();
    const targetBg = parseFloat(cTarget) || 100;
    const currentBg = parseFloat(cGlucose) || 0;
    const carbs = mealTotals.carbs > 0 ? mealTotals.carbs : (parseFloat(tCarbs) || 0);

    const carbInsulin = carbs / (cr || 15);
    let correctInsulin = 0;
    
    if (currentBg > 0) {
      correctInsulin = (currentBg - targetBg) / (isf || 50);
    }

    const total = carbInsulin + correctInsulin;
    const finalBolus = Math.max(0, Math.round(total * 100) / 100);

    setCCalculatedCarbInsulin(Math.round(carbInsulin * 100) / 100);
    setCCalculatedCorrectInsulin(Math.round(correctInsulin * 100) / 100);
    setCCalculatedBolus(finalBolus);
  };

  const handleExportToCareportal = () => {
    setTCarbs(mealTotals.carbs.toString());
    if (cCalculatedBolus) setTInsulin(cCalculatedBolus.toString());
    if (cGlucose) setTGlucose(cGlucose);
    
    let notes = `Refeição sugerida com ${mealTotals.carbs}g CHO`;
    if (mealTotals.ugp > 0) notes += `, ${mealTotals.ugp} UGP`;
    setTNotes(notes);
    
    setIsAddTreatmentModalOpen(true);
  };


  const handleAddFoodToMeal = () => {
    if (!selectedFood) {
      Alert.alert('Erro', 'Selecione um alimento da lista primeiro.');
      return;
    }
    const qty = parseFloat(foodQty);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Erro', 'Insira uma quantidade válida.');
      return;
    }

    const factor = qty / selectedFood.ratio;
    const carbs = selectedFood.carbs * factor;
    const prot = selectedFood.prot * factor;
    const fat = selectedFood.fat * factor;

    // Check if food already in list
    const newFood: MealFood = {
      id: selectedFood.id + '_' + Date.now(),
      name: selectedFood.name,
      quantity: qty,
      unit: selectedFood.unit,
      carbs: Math.round(carbs * 10) / 10,
      prot: Math.round(prot * 10) / 10,
      fat: Math.round(fat * 10) / 10
    };

    const newFoods = [...mealFoods, newFood];
    setMealFoods(newFoods);
    
    // Recalculate totals
    let tC = 0, tP = 0, tF = 0;
    newFoods.forEach(f => {
      tC += f.carbs;
      tP += f.prot;
      tF += f.fat;
    });
    
    const ugp = ((tP * 4) + (tF * 9)) / 100;
    const newTotals = {
      carbs: Math.round(tC * 10) / 10,
      prot: Math.round(tP * 10) / 10,
      fat: Math.round(tF * 10) / 10,
      ugp: Math.round(ugp * 10) / 10
    };
    setMealTotals(newTotals);

    // Auto-calcular bolus após adicionar ao prato (PRO)
    if (isPro) {
      const { isf, cr } = getProfileParams();
      const targetBg = parseFloat(cTarget) || 100;
      const currentBg = parseFloat(cGlucose) || 0;
      const carbInsulin = newTotals.carbs / (cr || 15);
      let correctInsulin = 0;
      if (currentBg > 0) {
        correctInsulin = (currentBg - targetBg) / (isf || 50);
      }
      const total = carbInsulin + correctInsulin;
      const finalBolus = Math.max(0, Math.round(total * 100) / 100);
      setCCalculatedCarbInsulin(Math.round(carbInsulin * 100) / 100);
      setCCalculatedCorrectInsulin(Math.round(correctInsulin * 100) / 100);
      setCCalculatedBolus(finalBolus);
    }

    // Reset picker
    setFoodSearch('');
    setSelectedFood(null);
  };

  const handleRemoveFoodFromMeal = (id: string) => {
    const newFoods = mealFoods.filter(f => f.id !== id);
    setMealFoods(newFoods);
    
    let tC = 0, tP = 0, tF = 0;
    newFoods.forEach(f => {
      tC += f.carbs;
      tP += f.prot;
      tF += f.fat;
    });
    
    const ugp = ((tP * 4) + (tF * 9)) / 100;
    const newTotals = {
      carbs: Math.round(tC * 10) / 10,
      prot: Math.round(tP * 10) / 10,
      fat: Math.round(tF * 10) / 10,
      ugp: Math.round(ugp * 10) / 10
    };
    setMealTotals(newTotals);

    // Auto-recalcular bolus após remover do prato (PRO)
    if (isPro && newFoods.length > 0) {
      const { isf, cr } = getProfileParams();
      const targetBg = parseFloat(cTarget) || 100;
      const currentBg = parseFloat(cGlucose) || 0;
      const carbInsulin = newTotals.carbs / (cr || 15);
      let correctInsulin = 0;
      if (currentBg > 0) {
        correctInsulin = (currentBg - targetBg) / (isf || 50);
      }
      const total = carbInsulin + correctInsulin;
      const finalBolus = Math.max(0, Math.round(total * 100) / 100);
      setCCalculatedCarbInsulin(Math.round(carbInsulin * 100) / 100);
      setCCalculatedCorrectInsulin(Math.round(correctInsulin * 100) / 100);
      setCCalculatedBolus(finalBolus);
    } else if (newFoods.length === 0) {
      setCCalculatedBolus(null);
    }
  };

  const handleClearMeal = () => {
    setMealFoods([]);
    setMealTotals({ carbs: 0, prot: 0, fat: 0, ugp: 0 });
    setCCalculatedBolus(null);
  };

  const renderCareportalTab = () => {
    // Autocomplete food filtering
    const normalizedSearch = normalizeText(foodSearch.trim());
    const matchingFoods = normalizedSearch.length > 1
      ? FOOD_LIBRARY.filter(f => normalizeText(f.name).includes(normalizedSearch)).slice(0, 8)
      : [];

    return (
      <View style={{ gap: 16, flex: 1 }}>
        {/* Montagem de Prato e Contagem de Carbos */}
        <View style={[styles.sectionCard, stylesTheme.card]}>
          <Text style={[styles.sectionTitle, stylesTheme.text, { fontSize: 13 * fontScale }]}>
            🍚 Contagem de Carboidratos & Montagem do Prato
          </Text>
          <Text style={[styles.sectionDesc, stylesTheme.textSec, { fontSize: 9.5 * fontScale, marginBottom: 12 }]}>
            Pesquise e selecione os alimentos abaixo para calcular o teor de carboidratos, proteínas, gorduras e UGP.
          </Text>

          {/* Seletor com Busca */}
          <View style={{ gap: 8, zIndex: 50, marginBottom: 12 }}>
            <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#475569', fontSize: 9.5 * fontScale }]}>
              Buscar Alimento
            </Text>
            <TextInput
              style={[styles.input, stylesTheme.input, { fontSize: 12.5 * fontScale }]}
              placeholder="Digite o nome do alimento... (Ex: Pão)"
              placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
              value={foodSearch}
              onChangeText={setFoodSearch}
            />

            {/* Dropdown de Autocomplete */}
            {matchingFoods.length > 0 && (
              <View style={{
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                borderWidth: 1,
                borderColor: isDark ? '#334155' : '#cbd5e1',
                borderRadius: 8,
                marginTop: 2,
                maxHeight: 180,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3
              }}>
                {matchingFoods.map(food => (
                  <Pressable
                    key={food.id}
                    onPress={() => {
                      setSelectedFood(food);
                      setFoodSearch(food.name);
                      if (food.unit === 'unidades') {
                        setFoodQty('1');
                      } else {
                        setFoodQty('100');
                      }
                    }}
                    style={({ pressed }) => [
                      { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 0.5, borderBottomColor: isDark ? '#334155' : '#e2e8f0' },
                      pressed && { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }
                    ]}
                  >
                    <Text style={{ color: stylesTheme.text.color, fontSize: 11.5 * fontScale }}>
                      {food.name} <Text style={{ color: stylesTheme.textSec.color, fontSize: 10 }}>({food.unit})</Text>
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Campo de Quantidade e Adição */}
          {selectedFood && (
            <View style={{
              backgroundColor: isDark ? 'rgba(99, 102, 241, 0.06)' : 'rgba(99, 102, 241, 0.04)',
              padding: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#6366f1',
              gap: 10,
              marginBottom: 12
            }}>
              <Text style={{ color: '#6366f1', fontWeight: 'bold', fontSize: 11 * fontScale }}>
                Selecionado: {selectedFood.name}
              </Text>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 2 }}>
                  <Text style={{ color: stylesTheme.textSec.color, fontSize: 9 * fontScale, marginBottom: 4 }}>
                    Quantidade ({selectedFood.unit})
                  </Text>
                  <TextInput
                    style={[styles.input, stylesTheme.input, { fontSize: 12 * fontScale, height: 38 }]}
                    keyboardType="numeric"
                    value={foodQty}
                    onChangeText={setFoodQty}
                  />
                </View>
                <Pressable
                  onPress={handleAddFoodToMeal}
                  style={({ pressed }) => [
                    { flex: 3, backgroundColor: '#6366f1', height: 38, borderRadius: 8, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-end' },
                    pressed && { opacity: 0.85 }
                  ]}
                >
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 11 * fontScale }}>
                    ADICIONAR AO PRATO
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Alimentos no Prato */}
          <Text style={{ color: stylesTheme.text.color, fontWeight: 'bold', fontSize: 11.5 * fontScale, marginTop: 8, marginBottom: 6 }}>
            🍱 Itens no Prato ({mealFoods.length})
          </Text>

          {mealFoods.length === 0 ? (
            <View style={{ paddingVertical: 14, alignItems: 'center', backgroundColor: isDark ? 'rgba(0,0,0,0.1)' : '#f8fafc', borderRadius: 8 }}>
              <Text style={{ fontStyle: 'italic', color: stylesTheme.textSec.color, fontSize: 11 * fontScale }}>
                Nenhum alimento no prato. Busque acima.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 6, marginBottom: 12 }}>
              {mealFoods.map((item, idx) => {
                const kcal = Math.round(item.carbs * 4 + item.prot * 4 + item.fat * 9);
                return (
                  <View key={item.id} style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 8,
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#ffffff',
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#e2e8f0',
                    borderRadius: 8
                  }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ color: stylesTheme.text.color, fontWeight: 'bold', fontSize: 11.5 * fontScale }} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={{ color: stylesTheme.textSec.color, fontSize: 9.5 * fontScale }}>
                        {item.quantity} {item.unit} • C:{item.carbs}g • P:{item.prot}g • G:{item.fat}g
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ color: '#0d9488', fontWeight: 'bold', fontSize: 10 * fontScale }}>{kcal} kcal</Text>
                      <Pressable
                        onPress={() => handleRemoveFoodFromMeal(item.id)}
                        style={({ pressed }) => [
                          { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(239, 68, 68, 0.1)', justifyContent: 'center', alignItems: 'center' },
                          pressed && { backgroundColor: 'rgba(239, 68, 68, 0.2)' }
                        ]}
                      >
                        <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 10 }}>✕</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}

              <Pressable
                onPress={handleClearMeal}
                style={({ pressed }) => [
                  { alignSelf: 'flex-end', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: '#ef4444' },
                  pressed && { backgroundColor: 'rgba(239, 68, 68, 0.05)' }
                ]}
              >
                <Text style={{ color: '#ef4444', fontSize: 9.5 * fontScale, fontWeight: 'bold' }}>LIMPAR PRATO</Text>
              </Pressable>
            </View>
          )}

          {/* Consolidação de Nutrientes */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingTop: 10,
            borderTopWidth: 0.5,
            borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1',
            marginTop: 8
          }}>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ color: stylesTheme.textSec.color, fontSize: 8.5 * fontScale }}>Carboidratos</Text>
              <Text style={{ color: '#0ea5e9', fontWeight: 'bold', fontSize: 13.5 * fontScale }}>{mealTotals.carbs}g</Text>
            </View>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ color: stylesTheme.textSec.color, fontSize: 8.5 * fontScale }}>Proteínas</Text>
              <Text style={{ color: stylesTheme.textSec.color, fontWeight: 'bold', fontSize: 13.5 * fontScale }}>{mealTotals.prot}g</Text>
            </View>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ color: stylesTheme.textSec.color, fontSize: 8.5 * fontScale }}>Gorduras</Text>
              <Text style={{ color: stylesTheme.textSec.color, fontWeight: 'bold', fontSize: 13.5 * fontScale }}>{mealTotals.fat}g</Text>
            </View>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ color: stylesTheme.textSec.color, fontSize: 8.5 * fontScale }}>Calorias</Text>
              <Text style={{ color: '#0d9488', fontWeight: 'bold', fontSize: 13.5 * fontScale }}>
                {Math.round(mealTotals.carbs * 4 + mealTotals.prot * 4 + mealTotals.fat * 9)} kcal
              </Text>
            </View>
          </View>

          {/* Alerta de UGP (Unidade de Gordura e Proteína) */}
          {mealTotals.ugp >= 1.0 && (
            <View style={{
              backgroundColor: isDark ? 'rgba(249, 115, 22, 0.08)' : 'rgba(249, 115, 22, 0.05)',
              borderWidth: 1,
              borderColor: '#f97316',
              padding: 10,
              borderRadius: 8,
              marginTop: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6
            }}>
              <Text style={{ fontSize: 14 }}>🍖</Text>
              <Text style={{ color: '#f97316', fontWeight: 'bold', fontSize: 10 * fontScale, flex: 1 }}>
                Atenção: Refeição com alto teor de proteínas/gorduras ({mealTotals.ugp} UGP). Considere aplicar insulina basal temporária ou prolongada.
              </Text>
            </View>
          )}

          {/* Ações de Exportação */}
          {mealTotals.carbs > 0 && (
            <Pressable
              onPress={handleExportToCareportal}
              style={({ pressed }) => [
                { backgroundColor: '#0d9488', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 12 },
                pressed && { opacity: 0.85 }
              ]}
            >
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 11 * fontScale }}>
                ENVIAR CARBOIDRATOS PARA CAREPORTAL
              </Text>
            </Pressable>
          )}
        </View>

        {/* Assistente de Sugestão de Bolus - Exclusivo PRO */}
        {isPro && (
          <View style={[styles.sectionCard, stylesTheme.card]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={[styles.sectionTitle, stylesTheme.text, { fontSize: 13 * fontScale }]}>
                🍽️ Assistente de Sugestão de Bolus
              </Text>
              <View style={{
                backgroundColor: '#0ea5e9',
                paddingVertical: 2,
                paddingHorizontal: 6,
                borderRadius: 4
              }}>
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 7 * fontScale, textTransform: 'uppercase' }}>
                  PRO Ativo
                </Text>
              </View>
            </View>
            <Text style={[styles.sectionDesc, stylesTheme.textSec, { fontSize: 9.5 * fontScale, marginBottom: 12 }]}>
              Calcula a dose recomendada de insulina rápida baseada nas relações de sensibilidade e carboidratos.
            </Text>

            <View style={{ gap: 10, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#475569', fontSize: 9.5 * fontScale }]}>Glicose Atual</Text>
                  <TextInput
                    style={[styles.input, stylesTheme.input, { fontSize: 13 * fontScale }]}
                    placeholder="Ex: 120"
                    placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                    keyboardType="numeric"
                    value={cGlucose}
                    onChangeText={setCGlucose}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#475569', fontSize: 9.5 * fontScale }]}>Alvo</Text>
                  <TextInput
                    style={[styles.input, stylesTheme.input, { fontSize: 13 * fontScale }]}
                    placeholder="Ex: 100"
                    placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                    keyboardType="numeric"
                    value={cTarget}
                    onChangeText={setCTarget}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#475569', fontSize: 9.5 * fontScale }]}>Carbos (g)</Text>
                  <TextInput
                    style={[styles.input, stylesTheme.input, { fontSize: 13 * fontScale, backgroundColor: mealTotals.carbs > 0 ? (isDark ? '#1e293b' : '#f1f5f9') : stylesTheme.input.backgroundColor }]}
                    placeholder="Ex: 45"
                    placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                    keyboardType="numeric"
                    editable={mealFoods.length === 0}
                    value={mealTotals.carbs > 0 ? mealTotals.carbs.toString() : tCarbs}
                    onChangeText={text => {
                      setTCarbs(text);
                      setMealTotals({ ...mealTotals, carbs: parseFloat(text) || 0 });
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#475569', fontSize: 9.5 * fontScale }]}>UGP (Gorduras/Prots)</Text>
                  <TextInput
                    style={[styles.input, stylesTheme.input, { fontSize: 13 * fontScale, backgroundColor: mealTotals.ugp > 0 ? (isDark ? '#1e293b' : '#f1f5f9') : stylesTheme.input.backgroundColor }]}
                    placeholder="Ex: 1.5"
                    placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                    keyboardType="numeric"
                    editable={mealFoods.length === 0}
                    value={mealTotals.ugp > 0 ? mealTotals.ugp.toString() : ''}
                    onChangeText={text => setMealTotals({ ...mealTotals, ugp: parseFloat(text) || 0 })}
                  />
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  { backgroundColor: '#0d9488', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 4 },
                  pressed && { opacity: 0.85 }
                ]}
                onPress={handleCalculateBolus}
              >
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 11.5 * fontScale }}>CALCULAR SUGESTÃO DE BOLUS</Text>
              </Pressable>
            </View>

            {cCalculatedBolus !== null && (
              <View style={{
                backgroundColor: isDark ? 'rgba(13, 148, 136, 0.1)' : 'rgba(13, 148, 136, 0.05)',
                padding: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#0d9488',
                marginBottom: 16
              }}>
                <Text style={{ color: '#0d9488', fontWeight: '900', fontSize: 16 * fontScale, textAlign: 'center', marginBottom: 4 }}>
                  Sugerido: {cCalculatedBolus} U
                </Text>
                <Text style={{ color: stylesTheme.textSec.color, fontSize: 10 * fontScale, textAlign: 'center' }}>
                  Refeição: {cCalculatedCarbInsulin} U  •  Correção: {cCalculatedCorrectInsulin} U
                </Text>
                
                <Pressable
                  style={({ pressed }) => [
                    { backgroundColor: '#4f46e5', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 12 },
                    pressed && { opacity: 0.85 }
                  ]}
                  onPress={handleExportToCareportal}
                >
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 11 * fontScale }}>ENVIAR PARA CAREPORTAL</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* Botão de Adicionar Registro Manual */}
        <Pressable
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: isDarkTheme ? '#334155' : '#cbd5e1', height: 44, borderRadius: 12 },
            pressed && { opacity: 0.85 }
          ]}
          onPress={() => {
            setTCarbs(mealTotals.carbs > 0 ? mealTotals.carbs.toString() : '');
            setTInsulin(cCalculatedBolus !== null ? cCalculatedBolus.toString() : '');
            setTGlucose(cGlucose);
            
            let notes = '';
            if (mealFoods.length > 0) {
              const itemsDesc = mealFoods.map(f => f.quantity + f.unit.slice(0, 2) + ' ' + f.name).join(', ');
              notes = `Refeição: ${itemsDesc}`;
              if (mealTotals.ugp > 0) notes += ` [${mealTotals.ugp} UGP]`;
            }
            setTNotes(notes);
            setIsAddTreatmentModalOpen(true);
          }}
        >
          <Text style={[styles.addButtonText, { fontSize: 11.5 * fontScale, color: isDarkTheme ? '#f8fafc' : '#0f172a' }]}>📝 REGISTRO MANUAL</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.container, stylesTheme.container, { paddingTop: insets.top }]}>
      {/* Cabeçalho */}
      <View style={[styles.header, stylesTheme.header]}>
        <Pressable
          style={({ pressed }) => [
            styles.backButton,
            pressed && { opacity: 0.6 }
          ]}
          onPress={() => router.back()}
        >
          <Text style={[styles.backText, { fontSize: 13 * fontScale }]}>
            ◀ Voltar
          </Text>
        </Pressable>
        <Text style={[styles.headerTitleText, stylesTheme.text, { fontSize: 14.5 * fontScale }]} numberOfLines={1}>
          Paciente: {name || 'Nightscout'}
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.refreshButton,
            pressed && { opacity: 0.6 }
          ]}
          onPress={() => fetchReportData()}
        >
          <Text style={{ fontSize: 20 }}>🔄</Text>
        </Pressable>
      </View>

      {/* Barra de Abas superior */}
      <View style={[styles.tabBar, stylesTheme.tabBar]}>
        <Pressable
          onPress={() => setActiveTab('report')}
          style={[styles.tabButton, activeTab === 'report' && styles.tabButtonActive]}
        >
          <Text style={{ fontWeight: activeTab === 'report' ? '900' : '700', color: activeTab === 'report' ? '#4f46e5' : (isDark ? '#e2e8f0' : '#475569'), fontSize: 10 * fontScale }}>
            📊 Relatório
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('assistant')}
          style={[styles.tabButton, activeTab === 'assistant' && styles.tabButtonActive]}
        >
          <Text style={{ fontWeight: activeTab === 'assistant' ? '900' : '700', color: activeTab === 'assistant' ? '#4f46e5' : (isDark ? '#e2e8f0' : '#475569'), fontSize: 10 * fontScale }}>
            🤖 Status
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('careportal')}
          style={[styles.tabButton, activeTab === 'careportal' && styles.tabButtonActive]}
        >
          <Text style={{ fontWeight: activeTab === 'careportal' ? '900' : '700', color: activeTab === 'careportal' ? '#4f46e5' : (isDark ? '#e2e8f0' : '#475569'), fontSize: 10 * fontScale }}>
            📝 Careportal
          </Text>
        </Pressable>
      </View>

      {/* Conteúdo em Loading ou Erro */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={[styles.loadingText, stylesTheme.textSec, { fontSize: 12 * fontScale }]}>
            Sincronizando dados com o servidor do paciente...
          </Text>
        </View>
      ) : errorMsg ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={[styles.errorTitle, stylesTheme.text, { fontSize: 14 * fontScale }]}>Falha de Conexão</Text>
          <Text style={[styles.errorSubtitle, stylesTheme.textSec, { fontSize: 11.5 * fontScale }]}>
            {errorMsg}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              pressed && { opacity: 0.8 }
            ]}
            onPress={() => fetchReportData()}
          >
            <Text style={[styles.retryButtonText, { fontSize: 11.5 * fontScale }]}>TENTAR NOVAMENTE</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContainer} style={{ flex: 1 }}>
          {activeTab === 'report' && renderReportTab()}
          {activeTab === 'assistant' && renderAssistantTab()}
          {activeTab === 'careportal' && renderCareportalTab()}
        </ScrollView>
      )}

      {/* Modal para Adicionar Novo Tratamento */}
      <Modal
        visible={isAddTreatmentModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsAddTreatmentModalOpen(false)}
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
                <Text style={[styles.modalTitle, stylesTheme.text, { fontSize: 16 * fontScale }]}>
                  Registrar Tratamento (Careportal)
                </Text>

                {/* Tipo de Registro */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#475569', fontSize: 9.5 * fontScale }]}>Categoria do Evento</Text>
                  <View style={styles.typeSelectorGrid}>
                    {[
                      { key: 'Meal Bolus', label: 'Refeição' },
                      { key: 'Snack', label: 'Lanche' },
                      { key: 'Correction Bolus', label: 'Correção' },
                      { key: 'Note', label: 'Nota' }
                    ].map(item => (
                      <Pressable
                        key={item.key}
                        onPress={() => setTType(item.key as any)}
                        style={[
                          styles.typeButton,
                          tType === item.key && { backgroundColor: '#4f46e5', borderColor: '#4f46e5' }
                        ]}
                      >
                        <Text style={[
                          styles.typeButtonText,
                          { color: tType === item.key ? '#ffffff' : isDark ? '#f8fafc' : '#0f172a', fontSize: 10 * fontScale }
                        ]}>
                          {item.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Campos Condicionais */}
                {tType !== 'Note' && (
                  <View style={styles.formRow}>
                    <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                      <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#475569', fontSize: 9.5 * fontScale }]}>Carbos (g)</Text>
                      <TextInput
                        style={[styles.input, stylesTheme.input, { fontSize: 12 * fontScale }]}
                        value={tCarbs}
                        onChangeText={setTCarbs}
                        placeholder="Ex: 40"
                        placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#475569', fontSize: 9.5 * fontScale }]}>Insulina (U)</Text>
                      <TextInput
                        style={[styles.input, stylesTheme.input, { fontSize: 12 * fontScale }]}
                        value={tInsulin}
                        onChangeText={setTInsulin}
                        placeholder="Ex: 3.5"
                        placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                )}

                {tType !== 'Note' && (
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#475569', fontSize: 9.5 * fontScale }]}>Glicemia Capilar (mg/dL)</Text>
                    <TextInput
                      style={[styles.input, stylesTheme.input, { fontSize: 12 * fontScale }]}
                      value={tGlucose}
                      onChangeText={setTGlucose}
                      placeholder="Opcional - Ex: 120"
                      placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                      keyboardType="numeric"
                    />
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#475569', fontSize: 9.5 * fontScale }]}>Notas / Observações</Text>
                  <TextInput
                    style={[styles.input, stylesTheme.input, { fontSize: 12 * fontScale, height: 60 }]}
                    value={tNotes}
                    onChangeText={setTNotes}
                    placeholder="Ex: Almoço massas ou correção de hipo"
                    placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                    multiline
                  />
                </View>

                <View style={styles.modalButtons}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalButton,
                      styles.cancelButton,
                      pressed && { opacity: 0.7 }
                    ]}
                    onPress={() => setIsAddTreatmentModalOpen(false)}
                  >
                    <Text style={[styles.cancelButtonText, { fontSize: 11 * fontScale }]}>CANCELAR</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalButton,
                      styles.saveButton,
                      (pressed || submittingTreatment) && { opacity: 0.8 }
                    ] as any}
                    onPress={handleAddTreatment}
                    disabled={submittingTreatment}
                  >
                    {submittingTreatment ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={[styles.saveButtonText, { fontSize: 11 * fontScale }] as any}>ENVIAR REGISTRO</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  backText: {
    fontWeight: '700',
    color: '#4f46e5',
  },
  headerTitleText: {
    fontWeight: '900',
    flex: 1,
    textAlign: 'center',
  },
  refreshButton: {
    padding: 12,
  },
  tabBar: {
    flexDirection: 'row',
    height: 42,
    borderBottomWidth: 1,
  },
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#4f46e5',
  },
  tabButtonText: {
    fontWeight: '700',
    color: '#94a3b8',
  },
  tabTextActive: {
    color: '#4f46e5',
    fontWeight: '900',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: 44,
    marginBottom: 10,
  },
  errorTitle: {
    fontWeight: 'bold',
    marginBottom: 6,
  },
  errorSubtitle: {
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '900',
  },
  sectionDesc: {
    fontWeight: '500',
    lineHeight: 14,
    marginBottom: 14,
  },
  periodSelectorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  periodButton: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  periodButtonText: {
    fontSize: 10.5,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  metricValue: {
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  metricUnit: {
    fontWeight: '600',
    marginTop: 2,
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  donutCenterTextContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  donutCenterValue: {
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  tirRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  tirLegendContainer: {
    flex: 1,
    gap: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendLabel: {
    fontWeight: '500',
    flex: 1,
  },
  legendValue: {
    fontWeight: 'bold',
  },
  heatmapScroll: {
    marginTop: 4,
    paddingBottom: 8,
  },
  heatmapContainer: {
    flexDirection: 'column',
    gap: 4,
  },
  heatmapHeaderRow: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 2,
  },
  heatmapDayLabelPlaceholder: {
    width: 32,
  },
  heatmapHourLabel: {
    width: 22,
    textAlign: 'center',
    fontWeight: '800',
  },
  heatmapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  heatmapDayLabel: {
    width: 32,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heatmapCell: {
    width: 22,
    height: 22,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heatmapCellValue: {
    fontSize: 7.5,
    fontWeight: '900',
    color: '#ffffff',
  },
  heatmapLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(148, 163, 184, 0.15)',
  },
  heatmapLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heatmapLegendBox: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  heatmapLegendText: {
    fontWeight: '600',
  },
  statusGrid: {
    gap: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(148, 163, 184, 0.1)',
  },
  statusLabel: {
    fontWeight: '700',
    marginBottom: 2,
  },
  statusValue: {
    fontWeight: '900',
  },
  statusGreen: {
    color: '#0d9488',
  },
  statusOrange: {
    color: '#f97316',
  },
  statusRed: {
    color: '#ef4444',
  },
  statusSlate: {
    color: '#64748b',
  },
  alertPulseText: {
    color: '#ef4444',
    fontWeight: 'bold',
    fontSize: 9.5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(239, 68, 68, 0.15)',
  },
  loopStatusContainer: {
    paddingVertical: 4,
  },
  indicatorCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  reasonBox: {
    padding: 10,
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  reasonLabel: {
    fontWeight: '700',
    marginBottom: 4,
  },
  reasonText: {
    fontWeight: '600',
    lineHeight: 15,
  },
  infoLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoKey: {
    width: 90,
    fontWeight: '700',
  },
  infoVal: {
    flex: 1,
    fontWeight: '600',
  },
  metabolicsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(148, 163, 184, 0.1)',
    paddingBottom: 12,
  },
  metabolicItem: {
    flex: 1,
    alignItems: 'center',
  },
  metabolicLabelText: {
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  metabolicValText: {
    fontWeight: '900',
  },
  metabolicProfileParams: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paramText: {
    fontWeight: '600',
  },
  paramBold: {
    fontWeight: '900',
  },
  addButton: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  addButtonText: {
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.8,
  },
  timelineScroll: {
    paddingVertical: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 56,
    position: 'relative',
    marginBottom: 10,
  },
  timelineLine: {
    position: 'absolute',
    left: 14,
    top: 24,
    bottom: -18,
    width: 2,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
  },
  timelineIconContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  timelineContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  timelineTitleText: {
    fontWeight: '800',
    flex: 1,
  },
  timelineTimeText: {
    fontWeight: '700',
    marginLeft: 10,
  },
  timelineDetailText: {
    fontWeight: 'bold',
    color: '#4f46e5',
    marginTop: 2,
  },
  timelineNotesText: {
    fontStyle: 'italic',
    marginTop: 2,
    fontWeight: '500',
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
    textAlign: 'center',
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
  typeSelectorGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  typeButton: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(148, 163, 184, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  typeButtonText: {
    fontWeight: '700',
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
