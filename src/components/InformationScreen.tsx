import {useTheme, useThemeStyles} from '../theme';
import React, {useState} from 'react';
import {Image, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {router, useLocalSearchParams} from 'expo-router';
import {SafeAreaView} from 'react-native-safe-area-context';
import Svg, {Path} from 'react-native-svg';

const developers = [
  {name: 'Simon Christian Carmen', role: 'Developer · UI/UX Design', image: require('../../assets/images/Graphic Designer Portfolio.png')},
  {name: 'Jacob Christopher Canete', role: 'Market Research · Software Testing', image: require('../../assets/images/jacob.png')},
  {name: 'John Vincent Garcia', role: 'Creativity · Teamwork', image: require('../../assets/images/garcia.jpg')},
  {name: 'Angela Faith Suba', role: 'Documentation · Data Gathering', image: require('../../assets/images/suba.jpg')},
];

const pages = {
  support: {title: 'Contact & Support', subtitle: 'A little help along the way.', cards: [
    ['Need help?', 'Start with the FAQ for help finding routes, saving journeys, and using the map.'],
    ['Report an issue', 'Note what you were doing, the route endpoints, your device model, and any error message. These details help explain the problem.'],
    ['Contact information', 'Support contact details have not been added yet. This app does not currently send support requests.'],
  ]},
  developers: {title: 'The PATHFINDER Team', subtitle: 'Meet the people behind your everyday travel companion.', cards: [
    ['Built for everyday commuters', 'Finding a way to school, work, or home should feel simpler. PATHFINDER aims to help people understand their route options, plan around their time and budget, and revisit journeys they need often.'],
    ['A solution shaped by people’s needs', 'Our goal is to make travel information easier to understand, especially for people exploring unfamiliar places. Today, the app offers estimated driving routes and sample transit journeys as a step toward that goal.'],
  ]},
  about: {title: 'About PATHFINDER', subtitle: 'Find your way. Ride better.', cards: [
    ['Your travel companion', 'Explore routes, compare journey options, and save trips for another day. PATHFINDER brings route information and maps together in one place.'],
    ['Driving routes', 'Road Finder retrieves estimated driving routes from OSRM. It does not provide live traffic or public transport fares.'],
    ['Transit demo', 'Transit routes, travel times, fares, and crowd levels are predefined samples for demonstration. They are not verified travel advice.'],
    ['Saved on your device', 'Saved journeys and journey history are stored on this device. The sample profile is for display only and is not a real account.'],
  ]},
} as const;
const questions = [
  ['How do I find a route?', 'Tap “Where to?” on the home screen, enter your origin and destination, and tap Find Routes. Tap a result to view its details.'],
  ['What is the difference between Road Finder and Transit demo?', 'Road Finder retrieves estimated driving routes from OSRM. Transit demo uses predefined sample routes, fares, times, and crowd levels. Neither provides live public transport information.'],
  ['How do I start a route?', 'Open Route Details and tap Start Route to open a separate journey map. The home map stays clear of route lines. Driving directions are available through Google Maps.'],
  ['How do I save a journey?', 'Tap Save Route in Route Details. Open Saved routes from the side menu to revisit it. Saved data stays on this device.'],
  ['Can I move and zoom the map?', 'Yes. Tap the map preview in Route Details, then drag to explore, pinch or double-tap to zoom, or tap Show entire route to fit the journey.'],
  ['Why is my location unavailable?', 'Check your device location services and the app’s location permission, then retry My location. You can also enter an origin manually.'],
  ['Are the profile details real?', 'No. The profile contains static sample information and is not connected to a real account.'],
];

export default function InformationScreen() {
  const {mode} = useTheme();
  const s = useThemeStyles(baseStyles);
  const {section} = useLocalSearchParams<{section?: string}>();
  const [expanded, setExpanded] = useState<number | null>(null);
  const faq = section === 'faq';
  const page = pages[section as keyof typeof pages] ?? pages.about;
  const back = () => router.canGoBack() ? router.back() : router.replace('/');
  return <SafeAreaView style={s.screen}>
    <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Back to home" onPress={back} style={s.back}><Svg accessible={false} width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={mode === 'light' ? '#386b27' : '#9be570'} strokeWidth={1.7}><Path d="M19 12H5m6-6-6 6 6 6" /></Svg></Pressable><Text style={s.brand}>PATHFINDER</Text></View>
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.hero}><Text accessibilityRole="header" style={s.title}>{faq ? 'FAQ' : page.title}</Text><Text style={s.subtitle}>{faq ? 'A few answers before you go.' : page.subtitle}</Text></View>
      {section === 'developers' && <View style={s.teamGrid}>{developers.map(developer => <View key={developer.name} style={s.teamCard}>
        <View style={s.portraitFrame}><Image source={developer.image} accessibilityLabel={`Portrait of ${developer.name}`} resizeMode="cover" style={s.portrait} /></View>
        <View style={s.teamCaption}><Text style={s.teamName}>{developer.name.split(' ').slice(0, -1).join(' ')}{'\n'}{developer.name.split(' ').at(-1)}</Text><Text style={s.teamRole}>{developer.role}</Text></View>
      </View>)}</View>}
      {faq ? questions.map(([question, answer], index) => <View key={question} style={s.card}>
        <Pressable accessibilityRole="button" accessibilityState={{expanded: expanded === index}} onPress={() => setExpanded(value => value === index ? null : index)} style={s.question}><Text style={s.heading}>{question}</Text><Text style={s.plus}>{expanded === index ? '−' : '+'}</Text></Pressable>
        {expanded === index && <Text style={s.answer}>{answer}</Text>}
      </View>) : page.cards.map(([title, copy]) => <View key={title} style={[s.card, s.information]}><Text style={s.heading}>{title}</Text><Text style={s.copy}>{copy}</Text></View>)}
      {section === 'support' && <Pressable accessibilityRole="button" onPress={() => router.push({pathname: '/information', params: {section: 'faq'}})} style={s.action}><Text style={s.actionText}>Browse FAQ</Text></Pressable>}
    </ScrollView>
  </SafeAreaView>;
}
const baseStyles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#000'}, header: {flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16},
  back: {width: 48, height: 48, borderRadius: 16, backgroundColor: '#1c2620', alignItems: 'center', justifyContent: 'center'},
  brand: {fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1.6, color: '#99a89d'},
  content: {padding: 16, gap: 12, width: '100%', maxWidth: 600, alignSelf: 'center', paddingBottom: 32},
  hero: {paddingVertical: 12, gap: 10, marginBottom: 8}, title: {fontFamily: 'Inter_600SemiBold', fontSize: 28, letterSpacing: -0.8, color: '#edf3ea'},
  subtitle: {fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 21, color: '#99a89d'},
  card: {borderRadius: 18, borderWidth: 1, borderColor: '#303d34', backgroundColor: '#19221c', overflow: 'hidden'},
  information: {padding: 18, gap: 10}, heading: {fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 22, color: '#edf3ea', flex: 1},
  copy: {fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 21, color: '#b6c1b9'},
  question: {flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, minHeight: 56},
  plus: {fontSize: 24, color: '#9be570'}, answer: {fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 21, color: '#b6c1b9', paddingHorizontal: 18, paddingBottom: 18},
  action: {minHeight: 52, borderRadius: 16, backgroundColor: '#9be570', alignItems: 'center', justifyContent: 'center', marginTop: 8},
  actionText: {fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#172510'},
  teamGrid: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', rowGap: 28, marginTop: 8, marginBottom: 8},
  teamCard: {width: '47%', padding: 10, borderRadius: 20, backgroundColor: '#19221c', borderWidth: 1, borderColor: '#334039'},
  portraitFrame: {aspectRatio: 1, width: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#edf3ea'},
  portrait: {position: 'absolute', top: 0, left: 0, width: '100%', height: '100%'},
  teamCaption: {paddingTop: 12, paddingBottom: 6, gap: 8, alignItems: 'center'},
  teamName: {fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 21, minHeight: 42, color: '#edf3ea', textAlign: 'center'},
  teamRole: {fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 18, minHeight: 36, color: '#99a89d', textAlign: 'center'},
});
