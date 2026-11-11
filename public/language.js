(() => {
  'use strict';
  const KEY = 'tezz-connect-language';
  const languages = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'हिन्दी' },
    { code: 'mr', name: 'मराठी' },
    { code: 'bn', name: 'বাংলা' }
  ];
  const copy = {
    hi: {
      'Understand your internet.':'अपने इंटरनेट को समझें।',
      'Make every connection better.':'हर कनेक्शन को बेहतर बनाएँ।',
      'Clear, practical knowledge for everyday internet users—from understanding speed and fixing Wi-Fi problems to choosing the right networking equipment.':'रोज़मर्रा के इंटरनेट उपयोगकर्ताओं के लिए सरल और उपयोगी जानकारी—इंटरनेट की गति समझने, वाई-फ़ाई की समस्याएँ ठीक करने और सही नेटवर्क उपकरण चुनने तक।',
      'Test your internet connection':'अपने इंटरनेट कनेक्शन की जाँच करें',
      'Explore the knowledge hub ↓':'ज्ञान केंद्र देखें ↓',
      'Practical explanations':'व्यावहारिक जानकारी',
      'Independent learning':'स्वयं सीखें',
      'Useful troubleshooting':'समस्या हल करने के उपयोगी तरीके',
      'Not sure where to begin? Follow the Internet Learning Roadmap.':'कहाँ से शुरू करें, समझ नहीं आ रहा? इंटरनेट लर्निंग रोडमैप अपनाएँ।',
      'One clear journey through internet basics, speed, Wi-Fi troubleshooting and network performance—with practical activities at every level.':'इंटरनेट की बुनियादी जानकारी, गति, वाई-फ़ाई समस्या समाधान और नेटवर्क प्रदर्शन को समझने की क्रमबद्ध यात्रा—हर स्तर पर व्यावहारिक गतिविधियों के साथ।',
      'Start the learning roadmap →':'लर्निंग रोडमैप शुरू करें →',
      'EXPLORE BY TOPIC':'विषय के अनुसार देखें',
      'What do you want to understand?':'आप क्या समझना चाहते हैं?',
      'Start with a topic. Each collection brings related guides together so you can find the right answer faster.':'किसी विषय से शुरुआत करें। हर संग्रह में उससे जुड़ी गाइड हैं, ताकि आप सही जानकारी जल्दी पा सकें।',
      'How the internet works':'इंटरनेट कैसे काम करता है',
      'Follow a website request from your device through your router, provider and server—and back.':'अपने डिवाइस से राउटर, इंटरनेट सेवा प्रदाता और सर्वर तक वेबसाइट अनुरोध की यात्रा समझें।',
      'Follow the network journey →':'नेटवर्क की यात्रा देखें →',
      'Internet fundamentals':'इंटरनेट की बुनियादी बातें',
      'Understand how the internet, your devices, router and service provider work together.':'जानें कि इंटरनेट, आपके डिवाइस, राउटर और सेवा प्रदाता मिलकर कैसे काम करते हैं।',
      'Learn the basics →':'बुनियादी बातें सीखें →',
      'Speed & bandwidth':'गति और बैंडविड्थ',
      'Download speed, upload speed, Mbps and what your activities actually need.':'डाउनलोड गति, अपलोड गति, Mbps और आपके कामों के लिए वास्तव में कितनी गति चाहिए।',
      'Explore speed →':'गति को समझें →',
      'Signals & performance':'सिग्नल और प्रदर्शन',
      'Latency, ping, jitter and the factors behind a responsive connection.':'लेटेंसी, पिंग, जिटर और तेज़ प्रतिक्रिया देने वाले कनेक्शन को प्रभावित करने वाले कारक।',
      'Understand performance →':'प्रदर्शन समझें →',
      'Wi-Fi signal simulator':'वाई-फ़ाई सिग्नल सिम्युलेटर',
      'Move a virtual router, change wall conditions and explore how Wi-Fi coverage can vary across a home.':'वर्चुअल राउटर की जगह और दीवारों की स्थिति बदलकर देखें कि घर में वाई-फ़ाई कवरेज कैसे बदलता है।',
      'Explore signal coverage →':'सिग्नल कवरेज देखें →',
      'Wi-Fi & troubleshooting':'वाई-फ़ाई और समस्या समाधान',
      'Improve coverage, find common Wi-Fi problems and work through practical checks.':'कवरेज बेहतर करें, आम वाई-फ़ाई समस्याएँ पहचानें और व्यावहारिक जाँच करें।',
      'Fix Wi-Fi issues →':'वाई-फ़ाई समस्याएँ ठीक करें →',
      'Networking equipment':'नेटवर्किंग उपकरण',
      'Learn about routers, mesh systems, extenders, Ethernet cables and switches.':'राउटर, मेश सिस्टम, एक्सटेंडर, ईथरनेट केबल और स्विच के बारे में जानें।',
      'Explore buying guides →':'खरीदारी गाइड देखें →',
      'Home network planner':'होम नेटवर्क प्लानर',
      'Plan a practical router, mesh, access-point and Ethernet layout for your home.':'अपने घर के लिए राउटर, मेश, एक्सेस पॉइंट और ईथरनेट का उपयोगी लेआउट बनाएँ।',
      'Build your network plan →':'अपना नेटवर्क प्लान बनाएँ →',
      'Wi-Fi security checkup':'वाई-फ़ाई सुरक्षा जाँच',
      'Review router encryption, passwords, updates, guest access and safer settings.':'राउटर एन्क्रिप्शन, पासवर्ड, अपडेट, गेस्ट एक्सेस और सुरक्षित सेटिंग्स की जाँच करें।',
      'Check Wi-Fi security →':'वाई-फ़ाई सुरक्षा जाँचें →',
      'Networking glossary':'नेटवर्किंग शब्दावली',
      'Search 24 plain-English explanations of internet, Wi-Fi and network terms.':'इंटरनेट, वाई-फ़ाई और नेटवर्क के 24 शब्दों की सरल व्याख्या खोजें।',
      'Explore the glossary →':'शब्दावली देखें →',
      'Internet for everyday use':'रोज़मर्रा के कामों के लिए इंटरनेट',
      'Explore gaming latency, jitter and packet loss with a hands-on network learning lab.':'व्यावहारिक नेटवर्क लर्निंग लैब में गेमिंग लेटेंसी, जिटर और पैकेट लॉस समझें।',
      'Try the gaming network lab →':'गेमिंग नेटवर्क लैब आज़माएँ →',
      'Connection troubleshooter':'कनेक्शन समस्या समाधान',
      'Choose a symptom and get a practical checklist for slow internet, weak Wi-Fi, lag and dropouts.':'लक्षण चुनें और धीमे इंटरनेट, कमज़ोर वाई-फ़ाई, लैग और बार-बार कनेक्शन टूटने के लिए उपयोगी चेकलिस्ट पाएँ।',
      'Build a troubleshooting plan →':'समस्या समाधान योजना बनाएँ →',
      'Interactive network lab':'इंटरैक्टिव नेटवर्क लैब',
      'Change Wi-Fi, latency and home network conditions to see how connections behave.':'वाई-फ़ाई, लेटेंसी और घरेलू नेटवर्क की स्थितियाँ बदलकर देखें कि कनेक्शन कैसे काम करता है।',
      'Try the simulations →':'सिम्युलेशन आज़माएँ →',
      'LEARN AT YOUR PACE':'अपनी गति से सीखें',
      'Explore the guides':'गाइड देखें',
      'Focused explainers to help you understand a topic and take the next practical step.':'किसी विषय को समझने और अगला व्यावहारिक कदम उठाने में मदद करने वाली गाइड।',
      'Find a guide':'गाइड खोजें',
      'Search Wi-Fi, ping, gaming, Mbps…':'वाई-फ़ाई, पिंग, गेमिंग, Mbps खोजें…',
      'All topics':'सभी विषय',
      'Internet basics':'इंटरनेट की बुनियादी बातें',
      'Performance':'प्रदर्शन',
      'Equipment':'उपकरण',
      'Everyday use':'रोज़मर्रा का उपयोग',
      'Interactive labs':'इंटरैक्टिव लैब',
      'Troubleshooting':'समस्या समाधान',
      'Clear':'हटाएँ'
    },
    mr: {
      'Understand your internet.':'तुमचे इंटरनेट समजून घ्या.',
      'Make every connection better.':'प्रत्येक कनेक्शन अधिक चांगले बनवा.',
      'Clear, practical knowledge for everyday internet users—from understanding speed and fixing Wi-Fi problems to choosing the right networking equipment.':'दररोज इंटरनेट वापरणाऱ्यांसाठी सोपी आणि उपयुक्त माहिती—वेग समजून घेण्यापासून वाय-फाय समस्या सोडवणे आणि योग्य नेटवर्क उपकरणे निवडण्यापर्यंत.',
      'Test your internet connection':'तुमचे इंटरनेट कनेक्शन तपासा',
      'Explore the knowledge hub ↓':'ज्ञान केंद्र पाहा ↓',
      'Practical explanations':'उपयुक्त स्पष्टीकरणे',
      'Independent learning':'स्वतः शिकणे',
      'Useful troubleshooting':'समस्या सोडवण्याचे मार्ग',
      'Not sure where to begin? Follow the Internet Learning Roadmap.':'कुठून सुरुवात करावी हे समजत नाही? इंटरनेट लर्निंग रोडमॅप वापरा.',
      'One clear journey through internet basics, speed, Wi-Fi troubleshooting and network performance—with practical activities at every level.':'इंटरनेटची मूलतत्त्वे, वेग, वाय-फाय समस्या निवारण आणि नेटवर्क कार्यक्षमता यांचा प्रत्येक टप्प्यावर कृतींसह सोपा प्रवास.',
      'Start the learning roadmap →':'शिकण्याचा रोडमॅप सुरू करा →',
      'EXPLORE BY TOPIC':'विषयानुसार पाहा',
      'What do you want to understand?':'तुम्हाला काय समजून घ्यायचे आहे?',
      'Start with a topic. Each collection brings related guides together so you can find the right answer faster.':'एखाद्या विषयापासून सुरुवात करा. प्रत्येक संग्रहात संबंधित मार्गदर्शिका एकत्र आहेत, त्यामुळे योग्य उत्तर लवकर मिळेल.',
      'How the internet works':'इंटरनेट कसे कार्य करते',
      'Follow a website request from your device through your router, provider and server—and back.':'तुमच्या डिव्हाइसपासून राउटर, सेवा प्रदाता आणि सर्व्हरपर्यंत वेबसाइट विनंतीचा प्रवास समजून घ्या.',
      'Follow the network journey →':'नेटवर्कचा प्रवास पाहा →',
      'Internet fundamentals':'इंटरनेटची मूलतत्त्वे',
      'Understand how the internet, your devices, router and service provider work together.':'इंटरनेट, तुमची उपकरणे, राउटर आणि सेवा प्रदाता एकत्र कसे काम करतात ते समजून घ्या.',
      'Learn the basics →':'मूलतत्त्वे शिका →',
      'Speed & bandwidth':'वेग आणि बँडविड्थ',
      'Download speed, upload speed, Mbps and what your activities actually need.':'डाउनलोड वेग, अपलोड वेग, Mbps आणि तुमच्या कामांसाठी प्रत्यक्षात किती वेग हवा.',
      'Explore speed →':'वेग समजून घ्या →',
      'Signals & performance':'सिग्नल आणि कार्यक्षमता',
      'Latency, ping, jitter and the factors behind a responsive connection.':'लेटन्सी, पिंग, जिटर आणि जलद प्रतिसाद देणाऱ्या कनेक्शनवर परिणाम करणारे घटक.',
      'Understand performance →':'कार्यक्षमता समजून घ्या →',
      'Wi-Fi signal simulator':'वाय-फाय सिग्नल सिम्युलेटर',
      'Move a virtual router, change wall conditions and explore how Wi-Fi coverage can vary across a home.':'व्हर्च्युअल राउटरची जागा आणि भिंतींची स्थिती बदलून घरातील वाय-फाय कव्हरेज कसे बदलते ते पाहा.',
      'Explore signal coverage →':'सिग्नल कव्हरेज पाहा →',
      'Wi-Fi & troubleshooting':'वाय-फाय आणि समस्या निवारण',
      'Improve coverage, find common Wi-Fi problems and work through practical checks.':'कव्हरेज सुधारा, सामान्य वाय-फाय समस्या ओळखा आणि उपयुक्त तपासण्या करा.',
      'Fix Wi-Fi issues →':'वाय-फाय समस्या सोडवा →',
      'Networking equipment':'नेटवर्किंग उपकरणे',
      'Learn about routers, mesh systems, extenders, Ethernet cables and switches.':'राउटर, मेश सिस्टीम, एक्स्टेंडर, इथरनेट केबल आणि स्विच यांची माहिती घ्या.',
      'Explore buying guides →':'खरेदी मार्गदर्शिका पाहा →',
      'Home network planner':'होम नेटवर्क प्लॅनर',
      'Plan a practical router, mesh, access-point and Ethernet layout for your home.':'तुमच्या घरासाठी राउटर, मेश, ॲक्सेस पॉइंट आणि इथरनेटची उपयुक्त मांडणी ठरवा.',
      'Build your network plan →':'तुमचा नेटवर्क आराखडा तयार करा →',
      'Wi-Fi security checkup':'वाय-फाय सुरक्षा तपासणी',
      'Review router encryption, passwords, updates, guest access and safer settings.':'राउटर एन्क्रिप्शन, पासवर्ड, अपडेट, गेस्ट ॲक्सेस आणि सुरक्षित सेटिंग्ज तपासा.',
      'Check Wi-Fi security →':'वाय-फाय सुरक्षा तपासा →',
      'Networking glossary':'नेटवर्किंग शब्दकोश',
      'Search 24 plain-English explanations of internet, Wi-Fi and network terms.':'इंटरनेट, वाय-फाय आणि नेटवर्कमधील २४ संज्ञांची सोपी स्पष्टीकरणे शोधा.',
      'Explore the glossary →':'शब्दकोश पाहा →',
      'Internet for everyday use':'दैनंदिन वापरासाठी इंटरनेट',
      'Explore gaming latency, jitter and packet loss with a hands-on network learning lab.':'प्रत्यक्ष नेटवर्क लर्निंग लॅबमध्ये गेमिंग लेटन्सी, जिटर आणि पॅकेट लॉस समजून घ्या.',
      'Try the gaming network lab →':'गेमिंग नेटवर्क लॅब वापरून पाहा →',
      'Connection troubleshooter':'कनेक्शन समस्या निवारक',
      'Choose a symptom and get a practical checklist for slow internet, weak Wi-Fi, lag and dropouts.':'लक्षण निवडा आणि मंद इंटरनेट, कमकुवत वाय-फाय, लॅग व कनेक्शन तुटण्यासाठी उपयुक्त तपासणी यादी मिळवा.',
      'Build a troubleshooting plan →':'समस्या निवारण योजना तयार करा →',
      'Interactive network lab':'इंटरॅक्टिव्ह नेटवर्क लॅब',
      'Change Wi-Fi, latency and home network conditions to see how connections behave.':'वाय-फाय, लेटन्सी आणि घरच्या नेटवर्कच्या परिस्थिती बदलून कनेक्शन कसे वागते ते पाहा.',
      'Try the simulations →':'सिम्युलेशन वापरून पाहा →',
      'LEARN AT YOUR PACE':'तुमच्या गतीने शिका',
      'Explore the guides':'मार्गदर्शिका पाहा',
      'Focused explainers to help you understand a topic and take the next practical step.':'विषय समजून घेण्यासाठी आणि पुढचे उपयुक्त पाऊल उचलण्यासाठी सोपी स्पष्टीकरणे.',
      'Find a guide':'मार्गदर्शिका शोधा',
      'Search Wi-Fi, ping, gaming, Mbps…':'वाय-फाय, पिंग, गेमिंग, Mbps शोधा…',
      'All topics':'सर्व विषय',
      'Internet basics':'इंटरनेटची मूलतत्त्वे',
      'Performance':'कार्यक्षमता',
      'Equipment':'उपकरणे',
      'Everyday use':'दैनंदिन वापर',
      'Interactive labs':'इंटरॅक्टिव्ह लॅब',
      'Troubleshooting':'समस्या निवारण',
      'Clear':'पुसून टाका'
    },
    bn: {
      'Understand your internet.':'আপনার ইন্টারনেট বুঝুন।',
      'Make every connection better.':'প্রতিটি সংযোগ আরও ভালো করুন।',
      'Clear, practical knowledge for everyday internet users—from understanding speed and fixing Wi-Fi problems to choosing the right networking equipment.':'প্রতিদিনের ইন্টারনেট ব্যবহারকারীদের জন্য সহজ ও কার্যকর তথ্য—গতি বোঝা, ওয়াই-ফাই সমস্যা সমাধান এবং সঠিক নেটওয়ার্ক সরঞ্জাম বেছে নেওয়া পর্যন্ত।',
      'Test your internet connection':'আপনার ইন্টারনেট সংযোগ পরীক্ষা করুন',
      'Explore the knowledge hub ↓':'জ্ঞানকেন্দ্র দেখুন ↓',
      'Practical explanations':'ব্যবহারিক ব্যাখ্যা',
      'Independent learning':'নিজে নিজে শিখুন',
      'Useful troubleshooting':'সমস্যা সমাধানের উপায়',
      'Not sure where to begin? Follow the Internet Learning Roadmap.':'কোথা থেকে শুরু করবেন বুঝতে পারছেন না? ইন্টারনেট লার্নিং রোডম্যাপ অনুসরণ করুন।',
      'One clear journey through internet basics, speed, Wi-Fi troubleshooting and network performance—with practical activities at every level.':'ইন্টারনেটের মূল বিষয়, গতি, ওয়াই-ফাই সমস্যা সমাধান এবং নেটওয়ার্ক কর্মক্ষমতা শেখার একটি সহজ পথ—প্রতিটি স্তরে ব্যবহারিক কাজসহ।',
      'Start the learning roadmap →':'লার্নিং রোডম্যাপ শুরু করুন →',
      'EXPLORE BY TOPIC':'বিষয় অনুযায়ী দেখুন',
      'What do you want to understand?':'আপনি কী বুঝতে চান?',
      'Start with a topic. Each collection brings related guides together so you can find the right answer faster.':'একটি বিষয় দিয়ে শুরু করুন। প্রতিটি সংগ্রহে সম্পর্কিত গাইড একসঙ্গে রয়েছে, যাতে দ্রুত সঠিক উত্তর খুঁজে পান।',
      'How the internet works':'ইন্টারনেট কীভাবে কাজ করে',
      'Follow a website request from your device through your router, provider and server—and back.':'আপনার ডিভাইস থেকে রাউটার, পরিষেবা প্রদানকারী ও সার্ভার পর্যন্ত ওয়েবসাইট অনুরোধের যাত্রা বুঝুন।',
      'Follow the network journey →':'নেটওয়ার্কের যাত্রা দেখুন →',
      'Internet fundamentals':'ইন্টারনেটের মূল বিষয়',
      'Understand how the internet, your devices, router and service provider work together.':'ইন্টারনেট, আপনার ডিভাইস, রাউটার ও পরিষেবা প্রদানকারী কীভাবে একসঙ্গে কাজ করে তা জানুন।',
      'Learn the basics →':'মূল বিষয় শিখুন →',
      'Speed & bandwidth':'গতি ও ব্যান্ডউইথ',
      'Download speed, upload speed, Mbps and what your activities actually need.':'ডাউনলোড গতি, আপলোড গতি, Mbps এবং আপনার কাজের জন্য আসলে কত গতি দরকার।',
      'Explore speed →':'গতি বুঝুন →',
      'Signals & performance':'সিগন্যাল ও কর্মক্ষমতা',
      'Latency, ping, jitter and the factors behind a responsive connection.':'লেটেন্সি, পিং, জিটার এবং দ্রুত প্রতিক্রিয়াশীল সংযোগের পেছনের কারণগুলি জানুন।',
      'Understand performance →':'কর্মক্ষমতা বুঝুন →',
      'Wi-Fi signal simulator':'ওয়াই-ফাই সিগন্যাল সিমুলেটর',
      'Move a virtual router, change wall conditions and explore how Wi-Fi coverage can vary across a home.':'ভার্চুয়াল রাউটারের অবস্থান ও দেয়ালের পরিস্থিতি বদলে বাড়িতে ওয়াই-ফাই কভারেজ কীভাবে বদলায় দেখুন।',
      'Explore signal coverage →':'সিগন্যাল কভারেজ দেখুন →',
      'Wi-Fi & troubleshooting':'ওয়াই-ফাই ও সমস্যা সমাধান',
      'Improve coverage, find common Wi-Fi problems and work through practical checks.':'কভারেজ উন্নত করুন, সাধারণ ওয়াই-ফাই সমস্যা খুঁজুন এবং ব্যবহারিক পরীক্ষা করুন।',
      'Fix Wi-Fi issues →':'ওয়াই-ফাই সমস্যা ঠিক করুন →',
      'Networking equipment':'নেটওয়ার্ক সরঞ্জাম',
      'Learn about routers, mesh systems, extenders, Ethernet cables and switches.':'রাউটার, মেশ সিস্টেম, এক্সটেন্ডার, ইথারনেট কেবল ও সুইচ সম্পর্কে জানুন।',
      'Explore buying guides →':'কেনাকাটার গাইড দেখুন →',
      'Home network planner':'হোম নেটওয়ার্ক প্ল্যানার',
      'Plan a practical router, mesh, access-point and Ethernet layout for your home.':'আপনার বাড়ির জন্য রাউটার, মেশ, অ্যাক্সেস পয়েন্ট ও ইথারনেটের ব্যবহারিক বিন্যাস পরিকল্পনা করুন।',
      'Build your network plan →':'আপনার নেটওয়ার্ক পরিকল্পনা তৈরি করুন →',
      'Wi-Fi security checkup':'ওয়াই-ফাই নিরাপত্তা পরীক্ষা',
      'Review router encryption, passwords, updates, guest access and safer settings.':'রাউটার এনক্রিপশন, পাসওয়ার্ড, আপডেট, অতিথি অ্যাক্সেস ও নিরাপদ সেটিংস পর্যালোচনা করুন।',
      'Check Wi-Fi security →':'ওয়াই-ফাই নিরাপত্তা পরীক্ষা করুন →',
      'Networking glossary':'নেটওয়ার্কিং শব্দকোষ',
      'Search 24 plain-English explanations of internet, Wi-Fi and network terms.':'ইন্টারনেট, ওয়াই-ফাই ও নেটওয়ার্কের ২৪টি শব্দের সহজ ব্যাখ্যা খুঁজুন।',
      'Explore the glossary →':'শব্দকোষ দেখুন →',
      'Internet for everyday use':'দৈনন্দিন ব্যবহারের ইন্টারনেট',
      'Explore gaming latency, jitter and packet loss with a hands-on network learning lab.':'হাতে-কলমে নেটওয়ার্ক লার্নিং ল্যাবে গেমিং লেটেন্সি, জিটার ও প্যাকেট লস বুঝুন।',
      'Try the gaming network lab →':'গেমিং নেটওয়ার্ক ল্যাব ব্যবহার করুন →',
      'Connection troubleshooter':'সংযোগ সমস্যা সমাধানকারী',
      'Choose a symptom and get a practical checklist for slow internet, weak Wi-Fi, lag and dropouts.':'লক্ষণ বেছে নিয়ে ধীর ইন্টারনেট, দুর্বল ওয়াই-ফাই, ল্যাগ ও সংযোগ বিচ্ছিন্নতার জন্য ব্যবহারিক তালিকা পান।',
      'Build a troubleshooting plan →':'সমস্যা সমাধানের পরিকল্পনা তৈরি করুন →',
      'Interactive network lab':'ইন্টারঅ্যাকটিভ নেটওয়ার্ক ল্যাব',
      'Change Wi-Fi, latency and home network conditions to see how connections behave.':'ওয়াই-ফাই, লেটেন্সি ও হোম নেটওয়ার্কের পরিস্থিতি বদলে সংযোগের আচরণ দেখুন।',
      'Try the simulations →':'সিমুলেশন ব্যবহার করুন →',
      'LEARN AT YOUR PACE':'নিজের গতিতে শিখুন',
      'Explore the guides':'গাইড দেখুন',
      'Focused explainers to help you understand a topic and take the next practical step.':'কোনো বিষয় বুঝতে এবং পরবর্তী ব্যবহারিক পদক্ষেপ নিতে সাহায্যকারী সহজ ব্যাখ্যা।',
      'Find a guide':'একটি গাইড খুঁজুন',
      'Search Wi-Fi, ping, gaming, Mbps…':'ওয়াই-ফাই, পিং, গেমিং, Mbps খুঁজুন…',
      'All topics':'সব বিষয়',
      'Internet basics':'ইন্টারনেটের মূল বিষয়',
      'Performance':'কর্মক্ষমতা',
      'Equipment':'সরঞ্জাম',
      'Everyday use':'দৈনন্দিন ব্যবহার',
      'Interactive labs':'ইন্টারঅ্যাকটিভ ল্যাব',
      'Troubleshooting':'সমস্যা সমাধান',
      'Clear':'মুছুন'
    }
  };
  Object.assign(copy.hi, {"In this guide":"इस गाइड में","Keep learning":"आगे सीखें","Try it yourself":"खुद करके देखें","What does internet speed actually mean?":"इंटरनेट की गति का वास्तव में क्या मतलब है?","Download speed and upload speed: what’s the difference?":"डाउनलोड और अपलोड गति में क्या अंतर है?","Download speed and upload speed: what's the difference?":"डाउनलोड और अपलोड गति में क्या अंतर है?","How much speed do you need?":"आपको कितनी इंटरनेट गति चाहिए?","How much internet speed might your home need?":"आपके घर को कितनी इंटरनेट गति की आवश्यकता हो सकती है?","How long will a download or upload take?":"डाउनलोड या अपलोड में कितना समय लगेगा?","How to get a useful speed-test result":"उपयोगी स्पीड टेस्ट परिणाम कैसे पाएँ","How to read your internet speed test results":"अपने इंटरनेट स्पीड टेस्ट के परिणाम कैसे समझें","Download and upload: look at both directions":"डाउनलोड और अपलोड—दोनों दिशाओं को देखें","Latency: how quickly does a response come back?":"लेटेंसी: जवाब कितनी जल्दी वापस आता है?","Jitter and packet loss: is the connection consistent?":"जिटर और पैकेट लॉस: क्या कनेक्शन स्थिर है?","Why one test may show a different result from another":"अलग-अलग टेस्ट में अलग परिणाम क्यों आ सकते हैं?","Does a faster internet plan always make everything faster?":"क्या तेज़ इंटरनेट प्लान से हर चीज़ तेज़ हो जाती है?","Bandwidth, speed and performance are related—but not identical":"बैंडविड्थ, गति और प्रदर्शन जुड़े हैं—लेकिन एक जैसे नहीं हैं","Frequently asked questions about internet speed":"इंटरनेट गति के बारे में अक्सर पूछे जाने वाले सवाल","What TEZZ CONNECT measures":"TEZZ CONNECT क्या मापता है","Check your connection":"अपना कनेक्शन जाँचें","Common questions about internet speed":"इंटरनेट गति से जुड़े आम सवाल","Is 100 Mbps the same as 100 MB per second?":"क्या 100 Mbps, 100 MB प्रति सेकंड के बराबर है?","Why does my download speed change during the day?":"दिन में मेरी डाउनलोड गति क्यों बदलती रहती है?","Will a faster plan fix buffering?":"क्या तेज़ प्लान से बफरिंग ठीक हो जाएगी?","Why is my speed test good but one website slow?":"स्पीड टेस्ट अच्छा है, फिर भी कोई वेबसाइट धीमी क्यों है?","How many speed tests should I run?":"मुझे कितने स्पीड टेस्ट करने चाहिए?","Should I choose my internet plan based only on download speed?":"क्या केवल डाउनलोड गति देखकर इंटरनेट प्लान चुनना चाहिए?","Is 100 Mbps fast enough for a family?":"क्या परिवार के लिए 100 Mbps पर्याप्त तेज़ है?","Why is my download speed lower than my internet plan?":"मेरी डाउनलोड गति मेरे इंटरनेट प्लान से कम क्यों है?","Does upload speed matter?":"क्या अपलोड गति मायने रखती है?","Are Mbps and MB/s the same?":"क्या Mbps और MB/s एक ही हैं?","What is latency?":"लेटेंसी क्या है?","What does ping mean?":"पिंग का क्या मतलब है?","What is jitter?":"जिटर क्या है?","Why do these numbers matter?":"ये आँकड़े क्यों मायने रखते हैं?","See how delay, jitter and packet loss change a connection":"देखें कि देरी, जिटर और पैकेट लॉस कनेक्शन को कैसे बदलते हैं","What can you do if response times are high?":"अगर प्रतिक्रिया समय अधिक हो तो आप क्या कर सकते हैं?","Why a fast internet plan can still feel slow":"तेज़ इंटरनेट प्लान भी धीमा क्यों महसूस हो सकता है","Four common reasons for high ping or unstable jitter":"उच्च पिंग या अस्थिर जिटर के चार आम कारण","1. Wi-Fi interference or a weak signal":"1. वाई-फ़ाई में रुकावट या कमज़ोर सिग्नल","2. A busy connection (sometimes called bufferbloat)":"2. व्यस्त कनेक्शन (जिसे कभी-कभी बफरब्लोट कहते हैं)","3. Distance and the route to the service":"3. दूरी और सेवा तक पहुँचने का नेटवर्क मार्ग","4. Congestion beyond your home":"4. आपके घर के बाहर नेटवर्क में भीड़","A simple way to isolate the source of the delay":"देरी का स्रोत पहचानने का आसान तरीका","What counts as good latency or jitter?":"अच्छी लेटेंसी या जिटर किसे माना जाता है?","Frequently asked questions about ping and jitter":"पिंग और जिटर के बारे में अक्सर पूछे जाने वाले सवाल","Is ping the same as latency?":"क्या पिंग और लेटेंसी एक ही हैं?","Can I have high download speed but high ping?":"क्या डाउनलोड गति अधिक होने पर भी पिंग अधिक हो सकता है?","Does jitter matter more than ping?":"क्या जिटर, पिंग से अधिक मायने रखता है?","Will changing DNS reduce ping?":"क्या DNS बदलने से पिंग कम होगा?","Should I upgrade my internet plan to fix high ping?":"क्या उच्च पिंग ठीक करने के लिए इंटरनेट प्लान अपग्रेड करना चाहिए?","Find the next step when your internet acts up.":"इंटरनेट में समस्या आने पर अगला सही कदम जानें।","What is going wrong?":"क्या समस्या हो रही है?","Three useful rules before you troubleshoot":"समस्या जाँचने से पहले तीन उपयोगी नियम","1. Compare more than one device":"1. एक से अधिक डिवाइस की तुलना करें","2. Separate Wi-Fi from the internet connection":"2. वाई-फ़ाई की समस्या और इंटरनेट कनेक्शन की समस्या अलग-अलग पहचानें","3. Change one variable at a time":"3. एक बार में केवल एक बदलाव करें","Measure before and after":"बदलाव से पहले और बाद में मापें","How to read what your checks show":"जाँच के परिणामों को कैसे समझें","Wired works well, Wi-Fi struggles":"केबल से कनेक्शन अच्छा है, वाई-फ़ाई में समस्या है","Several devices struggle, including over Ethernet":"ईथरनेट से जुड़े डिवाइस सहित कई डिवाइस में समस्या है","Only one device or one app has trouble":"केवल एक डिवाइस या ऐप में समस्या है","Download looks fine, but calls or games still lag":"डाउनलोड ठीक है, लेकिन कॉल या गेम में फिर भी लैग है","When should you contact your internet provider?":"इंटरनेट सेवा प्रदाता से कब संपर्क करना चाहिए?","Common troubleshooting questions":"समस्या समाधान से जुड़े आम सवाल","Should I restart my router every time the internet slows down?":"क्या इंटरनेट धीमा होने पर हर बार राउटर रीस्टार्ट करना चाहिए?","Does a fast speed test mean my connection is healthy?":"क्या तेज़ स्पीड टेस्ट का मतलब है कि मेरा कनेक्शन सही है?","Should I change DNS to fix weak Wi-Fi?":"क्या कमज़ोर वाई-फ़ाई ठीक करने के लिए DNS बदलना चाहिए?","Is it safe to factory-reset my router?":"क्या राउटर को फ़ैक्टरी रीसेट करना सुरक्षित है?","Related Internet Knowledge Hub guides":"इंटरनेट ज्ञान केंद्र की संबंधित गाइड"});
  Object.assign(copy.mr, {"In this guide":"या मार्गदर्शिकेत","Keep learning":"पुढे शिका","Try it yourself":"स्वतः करून पाहा","What does internet speed actually mean?":"इंटरनेटचा वेग म्हणजे नेमके काय?","Download speed and upload speed: what's the difference?":"डाउनलोड आणि अपलोड वेगात काय फरक आहे?","How much speed do you need?":"तुम्हाला किती इंटरनेट वेगाची गरज आहे?","How much internet speed might your home need?":"तुमच्या घराला किती इंटरनेट वेगाची गरज असू शकते?","How long will a download or upload take?":"डाउनलोड किंवा अपलोड होण्यासाठी किती वेळ लागेल?","How to get a useful speed-test result":"उपयुक्त स्पीड टेस्ट निकाल कसा मिळवावा","How to read your internet speed test results":"इंटरनेट स्पीड टेस्टचे निकाल कसे समजून घ्यावेत","Download and upload: look at both directions":"डाउनलोड आणि अपलोड—दोन्ही बाजू तपासा","Latency: how quickly does a response come back?":"लेटन्सी: प्रतिसाद किती लवकर परत येतो?","Jitter and packet loss: is the connection consistent?":"जिटर आणि पॅकेट लॉस: कनेक्शन स्थिर आहे का?","Why one test may show a different result from another":"वेगवेगळ्या चाचण्यांचे निकाल वेगळे का असू शकतात?","Does a faster internet plan always make everything faster?":"वेगवान इंटरनेट प्लॅनमुळे प्रत्येक गोष्ट वेगवान होते का?","Bandwidth, speed and performance are related—but not identical":"बँडविड्थ, वेग आणि कार्यक्षमता संबंधित आहेत—पण एकसारखे नाहीत","Frequently asked questions about internet speed":"इंटरनेट वेगाबद्दल वारंवार विचारले जाणारे प्रश्न","What TEZZ CONNECT measures":"TEZZ CONNECT काय मोजते","Check your connection":"तुमचे कनेक्शन तपासा","Common questions about internet speed":"इंटरनेट वेगाबद्दल सामान्य प्रश्न","Is 100 Mbps the same as 100 MB per second?":"100 Mbps म्हणजे 100 MB प्रति सेकंद का?","Why does my download speed change during the day?":"दिवसभरात माझा डाउनलोड वेग का बदलतो?","Will a faster plan fix buffering?":"वेगवान प्लॅनमुळे बफरिंगची समस्या सुटेल का?","Why is my speed test good but one website slow?":"स्पीड टेस्ट चांगली असूनही एखादी वेबसाइट संथ का आहे?","How many speed tests should I run?":"मी किती स्पीड टेस्ट कराव्यात?","Should I choose my internet plan based only on download speed?":"फक्त डाउनलोड वेगावरून इंटरनेट प्लॅन निवडावा का?","What is latency?":"लेटन्सी म्हणजे काय?","What does ping mean?":"पिंग म्हणजे काय?","What is jitter?":"जिटर म्हणजे काय?","Why do these numbers matter?":"हे आकडे महत्त्वाचे का आहेत?","See how delay, jitter and packet loss change a connection":"विलंब, जिटर आणि पॅकेट लॉसमुळे कनेक्शन कसे बदलते ते पाहा","What can you do if response times are high?":"प्रतिसाद वेळ जास्त असल्यास तुम्ही काय करू शकता?","Why a fast internet plan can still feel slow":"वेगवान इंटरनेट प्लॅन असूनही कनेक्शन संथ का वाटते","Four common reasons for high ping or unstable jitter":"जास्त पिंग किंवा अस्थिर जिटरची चार सामान्य कारणे","1. Wi-Fi interference or a weak signal":"1. वाय-फायमध्ये व्यत्यय किंवा कमकुवत सिग्नल","2. A busy connection (sometimes called bufferbloat)":"2. व्यस्त कनेक्शन (कधीकधी बफरब्लोट म्हणतात)","3. Distance and the route to the service":"3. अंतर आणि सेवेकडे जाणारा नेटवर्क मार्ग","4. Congestion beyond your home":"4. घराबाहेरील नेटवर्कमधील गर्दी","A simple way to isolate the source of the delay":"विलंबाचे मूळ कारण शोधण्याची सोपी पद्धत","What counts as good latency or jitter?":"चांगली लेटन्सी किंवा जिटर किती असावी?","Frequently asked questions about ping and jitter":"पिंग आणि जिटरबद्दल वारंवार विचारले जाणारे प्रश्न","Is ping the same as latency?":"पिंग आणि लेटन्सी एकच आहेत का?","Can I have high download speed but high ping?":"डाउनलोड वेग जास्त असूनही पिंग जास्त असू शकतो का?","Does jitter matter more than ping?":"पिंगपेक्षा जिटर अधिक महत्त्वाचा आहे का?","Will changing DNS reduce ping?":"DNS बदलल्याने पिंग कमी होईल का?","Should I upgrade my internet plan to fix high ping?":"जास्त पिंग कमी करण्यासाठी इंटरनेट प्लॅन अपग्रेड करावा का?","Find the next step when your internet acts up.":"इंटरनेटमध्ये अडचण आल्यास पुढचे योग्य पाऊल शोधा.","What is going wrong?":"नेमकी अडचण काय आहे?","Three useful rules before you troubleshoot":"समस्या तपासण्यापूर्वी तीन उपयुक्त नियम","1. Compare more than one device":"1. एकापेक्षा जास्त उपकरणांची तुलना करा","2. Separate Wi-Fi from the internet connection":"2. वाय-फायची समस्या आणि इंटरनेट कनेक्शनची समस्या वेगळी ओळखा","3. Change one variable at a time":"3. एका वेळी एकच गोष्ट बदला","Measure before and after":"बदलापूर्वी आणि नंतर मोजमाप करा","How to read what your checks show":"तपासणीचे निष्कर्ष कसे समजून घ्यावेत","Wired works well, Wi-Fi struggles":"केबलने कनेक्शन चांगले आहे, वाय-फायमध्ये अडचण आहे","Several devices struggle, including over Ethernet":"इथरनेटने जोडलेल्या उपकरणांसह अनेक उपकरणांमध्ये अडचण आहे","Only one device or one app has trouble":"फक्त एका उपकरणात किंवा ॲपमध्ये अडचण आहे","Download looks fine, but calls or games still lag":"डाउनलोड ठीक आहे, पण कॉल किंवा गेममध्ये अजूनही लॅग आहे","When should you contact your internet provider?":"इंटरनेट सेवा प्रदात्याशी कधी संपर्क साधावा?","Common troubleshooting questions":"समस्या निवारणाबद्दल सामान्य प्रश्न","Should I restart my router every time the internet slows down?":"इंटरनेट संथ झाल्यावर प्रत्येक वेळी राउटर रीस्टार्ट करावा का?","Does a fast speed test mean my connection is healthy?":"स्पीड टेस्ट चांगली म्हणजे माझे कनेक्शन व्यवस्थित आहे का?","Should I change DNS to fix weak Wi-Fi?":"कमकुवत वाय-फाय सुधारण्यासाठी DNS बदलावा का?","Is it safe to factory-reset my router?":"राउटर फॅक्टरी रीसेट करणे सुरक्षित आहे का?","Related Internet Knowledge Hub guides":"इंटरनेट ज्ञान केंद्रातील संबंधित मार्गदर्शिका"});
  Object.assign(copy.bn, {"In this guide":"এই গাইডে","Keep learning":"শিখতে থাকুন","Try it yourself":"নিজে চেষ্টা করুন","What does internet speed actually mean?":"ইন্টারনেটের গতি বলতে আসলে কী বোঝায়?","Download speed and upload speed: what's the difference?":"ডাউনলোড ও আপলোড গতির মধ্যে পার্থক্য কী?","How much speed do you need?":"আপনার কতটা ইন্টারনেট গতি দরকার?","How much internet speed might your home need?":"আপনার বাড়ির কতটা ইন্টারনেট গতি প্রয়োজন হতে পারে?","How long will a download or upload take?":"ডাউনলোড বা আপলোড করতে কত সময় লাগবে?","How to get a useful speed-test result":"কীভাবে কার্যকর স্পিড টেস্টের ফল পাবেন","How to read your internet speed test results":"ইন্টারনেট স্পিড টেস্টের ফল কীভাবে বুঝবেন","Download and upload: look at both directions":"ডাউনলোড ও আপলোড—দুই দিকই দেখুন","Latency: how quickly does a response come back?":"লেটেন্সি: উত্তর কত দ্রুত ফিরে আসে?","Jitter and packet loss: is the connection consistent?":"জিটার ও প্যাকেট লস: সংযোগ কি স্থিতিশীল?","Why one test may show a different result from another":"একেকটি পরীক্ষায় ফল আলাদা হতে পারে কেন?","Does a faster internet plan always make everything faster?":"দ্রুত ইন্টারনেট প্ল্যান কি সবকিছু দ্রুত করে?","Bandwidth, speed and performance are related—but not identical":"ব্যান্ডউইথ, গতি ও কর্মক্ষমতা সম্পর্কিত—তবে এক নয়","Frequently asked questions about internet speed":"ইন্টারনেটের গতি নিয়ে সাধারণ প্রশ্ন","What TEZZ CONNECT measures":"TEZZ CONNECT কী পরিমাপ করে","Check your connection":"আপনার সংযোগ পরীক্ষা করুন","Common questions about internet speed":"ইন্টারনেটের গতি নিয়ে সাধারণ প্রশ্ন","Is 100 Mbps the same as 100 MB per second?":"100 Mbps কি প্রতি সেকেন্ডে 100 MB-এর সমান?","Why does my download speed change during the day?":"দিনের বিভিন্ন সময়ে ডাউনলোডের গতি বদলায় কেন?","Will a faster plan fix buffering?":"দ্রুত প্ল্যান কি বাফারিং সমস্যার সমাধান করবে?","Why is my speed test good but one website slow?":"স্পিড টেস্ট ভালো হলেও একটি ওয়েবসাইট ধীর কেন?","How many speed tests should I run?":"কতবার স্পিড টেস্ট করা উচিত?","Should I choose my internet plan based only on download speed?":"শুধু ডাউনলোডের গতি দেখে কি ইন্টারনেট প্ল্যান বেছে নেওয়া উচিত?","What is latency?":"লেটেন্সি কী?","What does ping mean?":"পিং বলতে কী বোঝায়?","What is jitter?":"জিটার কী?","Why do these numbers matter?":"এই সংখ্যাগুলি গুরুত্বপূর্ণ কেন?","See how delay, jitter and packet loss change a connection":"বিলম্ব, জিটার ও প্যাকেট লস কীভাবে সংযোগ বদলে দেয় দেখুন","What can you do if response times are high?":"প্রতিক্রিয়ার সময় বেশি হলে আপনি কী করতে পারেন?","Why a fast internet plan can still feel slow":"দ্রুত ইন্টারনেট প্ল্যানও ধীর মনে হতে পারে কেন","Four common reasons for high ping or unstable jitter":"বেশি পিং বা অস্থির জিটারের চারটি সাধারণ কারণ","1. Wi-Fi interference or a weak signal":"1. ওয়াই-ফাইতে বাধা বা দুর্বল সিগন্যাল","2. A busy connection (sometimes called bufferbloat)":"2. ব্যস্ত সংযোগ (কখনও বাফারব্লোট বলা হয়)","3. Distance and the route to the service":"3. দূরত্ব ও পরিষেবায় পৌঁছানোর নেটওয়ার্ক পথ","4. Congestion beyond your home":"4. বাড়ির বাইরের নেটওয়ার্কে ভিড়","A simple way to isolate the source of the delay":"বিলম্বের উৎস খুঁজে বের করার সহজ উপায়","What counts as good latency or jitter?":"কতটা লেটেন্সি বা জিটার ভালো বলে ধরা হয়?","Frequently asked questions about ping and jitter":"পিং ও জিটার নিয়ে সাধারণ প্রশ্ন","Is ping the same as latency?":"পিং ও লেটেন্সি কি একই?","Can I have high download speed but high ping?":"ডাউনলোডের গতি বেশি হলেও কি পিং বেশি হতে পারে?","Does jitter matter more than ping?":"পিংয়ের চেয়ে জিটার কি বেশি গুরুত্বপূর্ণ?","Will changing DNS reduce ping?":"DNS বদলালে কি পিং কমবে?","Should I upgrade my internet plan to fix high ping?":"বেশি পিং কমাতে কি ইন্টারনেট প্ল্যান আপগ্রেড করা উচিত?","Find the next step when your internet acts up.":"ইন্টারনেটে সমস্যা হলে পরবর্তী করণীয় খুঁজে নিন।","What is going wrong?":"কী সমস্যা হচ্ছে?","Three useful rules before you troubleshoot":"সমস্যা সমাধানের আগে তিনটি কার্যকর নিয়ম","1. Compare more than one device":"1. একাধিক ডিভাইসের তুলনা করুন","2. Separate Wi-Fi from the internet connection":"2. ওয়াই-ফাই সমস্যা ও ইন্টারনেট সংযোগের সমস্যা আলাদা করুন","3. Change one variable at a time":"3. একবারে একটি বিষয় পরিবর্তন করুন","Measure before and after":"পরিবর্তনের আগে ও পরে মাপুন","How to read what your checks show":"পরীক্ষার ফল কীভাবে বুঝবেন","Wired works well, Wi-Fi struggles":"তারযুক্ত সংযোগ ভালো, ওয়াই-ফাইতে সমস্যা","Several devices struggle, including over Ethernet":"ইথারনেট-সহ একাধিক ডিভাইসে সমস্যা হচ্ছে","Only one device or one app has trouble":"শুধু একটি ডিভাইস বা অ্যাপে সমস্যা","Download looks fine, but calls or games still lag":"ডাউনলোড ঠিক আছে, কিন্তু কল বা গেমে এখনও ল্যাগ হচ্ছে","When should you contact your internet provider?":"কখন ইন্টারনেট পরিষেবা প্রদানকারীর সঙ্গে যোগাযোগ করবেন?","Common troubleshooting questions":"সমস্যা সমাধান নিয়ে সাধারণ প্রশ্ন","Should I restart my router every time the internet slows down?":"ইন্টারনেট ধীর হলেই কি রাউটার রিস্টার্ট করা উচিত?","Does a fast speed test mean my connection is healthy?":"স্পিড টেস্ট দ্রুত হলেই কি সংযোগ ভালো বোঝায়?","Should I change DNS to fix weak Wi-Fi?":"দুর্বল ওয়াই-ফাই ঠিক করতে কি DNS বদলানো উচিত?","Is it safe to factory-reset my router?":"রাউটার ফ্যাক্টরি রিসেট করা কি নিরাপদ?","Related Internet Knowledge Hub guides":"ইন্টারনেট জ্ঞানকেন্দ্রের সম্পর্কিত গাইড"});
  const rtl = new Set(['ar', 'ur']);
  const supported = new Set(languages.map(item => item.code));
  const readLanguage = () => {
    try {
      const value = localStorage.getItem(KEY) || 'en';
      return supported.has(value) ? value : 'en';
    } catch { return 'en'; }
  };
  let language = readLanguage();
  const originals = new WeakMap();
  function translateText(root) {
    if (language === 'en') {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (originals.has(node)) node.nodeValue = originals.get(node);
      }
      return;
    }
    const dictionary = copy[language] || {};
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT|OPTION)$/i.test(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.closest('[data-no-translate],script,style,code,pre')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      if (!originals.has(node)) originals.set(node, node.nodeValue);
      const original = originals.get(node);
      const trimmed = original.trim();
      const replacement = dictionary[trimmed] || original;
      if (node.nodeValue !== replacement) node.nodeValue = replacement;
    });
  }
  function addPicker() {
    const host = document.querySelector('.head-inner');
    if (!host || host.querySelector('[data-tezz-language-picker]')) return;
    const label = document.createElement('label');
    label.dataset.tezzLanguagePicker = 'true';
    label.setAttribute('aria-label', 'Choose website language');
    label.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin-inline-start:12px;font:600 12px/1.2 system-ui,sans-serif;color:inherit;white-space:nowrap';
    const icon = document.createElement('span');
    icon.textContent = '文';
    icon.setAttribute('aria-hidden', 'true');
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Website language');
    select.style.cssText = 'max-width:132px;padding:8px 26px 8px 9px;border:1px solid #6c8799;border-radius:9px;background:#10283e;color:#fff;font:600 12px system-ui,sans-serif';
    languages.forEach(item => {
      const option = document.createElement('option');
      option.value = item.code;
      option.textContent = item.name;
      select.append(option);
    });
    select.value = language;
    select.addEventListener('change', () => setLanguage(select.value));
    label.append(icon, select);
    host.append(label);
  }
  function setLanguage(next) {
    language = supported.has(next) ? next : 'en';
    try { localStorage.setItem(KEY, language); } catch {}
    document.documentElement.lang = language;
    document.documentElement.dir = rtl.has(language) ? 'rtl' : 'ltr';
    const picker = document.querySelector('[data-tezz-language-picker] select');
    if (picker) picker.value = language;
    translateText(document.body);
    document.dispatchEvent(new CustomEvent('tezz-language-change', { detail: { language } }));
  }
  function init() {
    document.documentElement.lang = language;
    document.documentElement.dir = rtl.has(language) ? 'rtl' : 'ltr';
    addPicker();
    translateText(document.body);
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'childList') record.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) translateText(node);
          else if (node.nodeType === Node.TEXT_NODE) translateText(node.parentElement || document.body);
        });
        else if (record.type === 'characterData') translateText(record.target.parentElement || document.body);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('storage', event => {
      if (event.key === KEY) setLanguage(event.newValue || 'en');
    });
    window.TEZZLanguage = { setLanguage, getLanguage: () => language, languages };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();