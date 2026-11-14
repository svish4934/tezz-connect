(() => {
  'use strict';
  const KEY = 'tezz-connect-language';
  // The manifest is the single source of truth for enabled locales.
  // Add a locale there when its reviewed translation bundle is ready.
  let languages = [
    { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr' },
    { code: 'hi', name: 'हिन्दी', nativeName: 'हिन्दी', direction: 'ltr', bundle: '/locales/hi/common.json' },
    { code: 'mr', name: 'मराठी', nativeName: 'मराठी', direction: 'ltr', bundle: '/locales/mr/common.json' },
    { code: 'bn', name: 'বাংলা', nativeName: 'বাংলা', direction: 'ltr', bundle: '/locales/bn/common.json' },
    { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文', direction: 'ltr', bundle: '/locales/zh-CN/common.json' },
    { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)', direction: 'ltr', bundle: '/locales/pt-BR/common.json' },
    { code: 'es', name: 'Spanish', nativeName: 'Español', direction: 'ltr', bundle: '/locales/es/common.json' },
    { code: 'fr', name: 'French', nativeName: 'Français', direction: 'ltr', bundle: '/locales/fr/common.json' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl', bundle: '/locales/ar/common.json' }
  ];
  let supported = new Set(languages.map(item => item.code));
  let directions = new Map(languages.map(item => [item.code, item.direction || 'ltr']));
  const copy = Object.create(null);
  const readLanguage = () => {
    try {
      const value = localStorage.getItem(KEY) || 'en';
      return supported.has(value) ? value : 'en';
    } catch { return 'en'; }
  };
  let language = 'en';
  const originals = new WeakMap();
  const localeBundles = Object.create(null);
  const sourceStrings = {
    'common.next': 'Next step →',
    'guide.speed.lede': "Confused by Mbps, download speed or upload speed? Learn what your speed test results mean, estimate how long files may take to transfer, and work out what your home actually needs—in simple language.",
    'guide.speed.meta': "TEZZ CONNECT · Practical guide · Updated 6 November 2026",
    'guide.speed.toc.mbps': "What Mbps means",
    'guide.speed.toc.directions': "Download vs upload",
    'guide.speed.toc.need': "How much speed do you need?",
    'guide.speed.toc.planner': "Estimate your household needs",
    'guide.speed.toc.transfer': "Estimate download and upload time",
    'guide.speed.toc.test': "How to run a useful test",
    'guide.speed.planner.explanation': "Includes a 30% planning margin and a small allowance for ordinary background activity.",
    'guide.speed.planner.disclaimer_full': "Important: These are simple planning assumptions, not official minimums or a guarantee. Actual requirements vary by app, video quality, device, Wi-Fi conditions and simultaneous activity. Check the service provider's recommendations for your apps. Gaming is often more sensitive to latency and stability than raw bandwidth.",
    'guide.speed.transfer.speed_label_full': "Your download speed (Mbps)",
    'guide.speed.transfer.time_initial': "About 3 minutes 20 seconds",
    'guide.speed.transfer.tip_full': "Quick tip: A 100 Mbps plan does not mean 100 MB downloads every second. Mbps is megabits; MB is megabytes. There are 8 bits in 1 byte.",
    'guide.speed.read.directions_heading': "Download and upload: look at both directions",
    'guide.speed.definition.bandwidth': "Bandwidth: how much data a connection could carry under suitable conditions.",
    'guide.speed.definition.throughput': "Throughput: how much data is actually transferred per second in a particular test or activity.",
    'guide.speed.definition.latency': "Latency: how long a request takes to receive a response.",
    'guide.speed.definition.jitter': "Jitter: how much packet or response timing varies.",
    'guide.speed.definition.loss': "Packet loss: the share of packets that fail to reach their destination.",
    'guide.speed.cta.test': "Open the speed test →",
    'guide.speed.quiz.legend': "Choose one answer",
    'guide.speed.related.eyebrow': "YOUR NEXT STEP",
    'guide.speed.related.card1.title.full': "Upload speed explained",
    'guide.speed.related.card1.desc.full': "Understand the data your devices send upstream.",
    'guide.speed.related.card2.title.full': "Internet speed for gaming",
    'guide.speed.related.card2.desc.full': "See why stable response time matters in games.",
    'guide.speed.related.card3.title.full': "What is the internet?",
    'guide.speed.related.card3.desc.full': "Start with the networks behind your connection.",
    'common.choose_language': 'Choose website language',
    'common.language': 'Website language',
    'common.step_count': 'STEP',
    'common.of': 'OF',
    'common.journey_complete': 'Journey complete',
    'common.choose_answer': 'Choose an answer first.',
    'common.dns_feedback': 'DNS helps find the network address associated with a domain name. It does not boost Wi-Fi signal or increase your plan speed.',
    'common.correct_prefix': 'Correct! ',
    'common.incorrect_prefix': 'Not quite. ',
    'common.less_second': 'Less than 1 second',
    'common.about': 'About',
    'common.second': 'seconds',
    'common.minute': 'minutes',
    'common.hour': 'hours',
    'common.enter_valid_transfer': 'Enter a file size above 0 (up to 100,000) and a speed above 0 Mbps (up to 100,000).',
    'common.estimate_at': 'At ',
    'common.file_may_take': ' file may take ',
    'common.to_transfer': ' to transfer ',
    'common.download_word': 'download',
    'common.upload_word': 'upload',
    'common.transfer_end': ' in this estimate.',
    'guide.internet.quiz_explanation': "That's right. Wi-Fi is the wireless link between your devices and router. Your internet service is the connection from your home network to other networks.",
    'guide.internet.part.device.kicker': "START HERE",
    'guide.internet.part.device.title': "Your device starts the request",
    'guide.internet.part.device.description': "Your phone or computer asks for a website when you type an address, tap a link or open an app.",
    'guide.internet.part.device.impact': "An older device, busy background apps or an outdated browser can make pages feel slow even when the connection is fine.",
    'guide.internet.part.wifi.kicker': "LOCAL CONNECTION",
    'guide.internet.part.wifi.title': "Wi-Fi or Ethernet carries data to your router",
    'guide.internet.part.wifi.description': "Wi-Fi sends data wirelessly through radio signals. Ethernet uses a cable. Both connect your device to your home network.",
    'guide.internet.part.wifi.impact': "Distance, thick walls and radio interference can weaken Wi-Fi. A damaged cable or adapter can affect a wired connection.",
    'guide.internet.part.router.kicker': "HOME NETWORK",
    'guide.internet.part.router.title': "The router directs traffic",
    'guide.internet.part.router.description': "Your router connects devices in your home and forwards their data towards the internet. It also helps returning data reach the right device.",
    'guide.internet.part.router.impact': "Poor router placement, old equipment, overloaded hardware or incorrect settings can affect the whole home network.",
    'guide.internet.part.provider.kicker': "NETWORK TO NETWORK",
    'guide.internet.part.provider.title': "Your provider links your home to other networks",
    'guide.internet.part.provider.description': "Your internet service provider carries traffic from your home connection into its network and towards the destination. The route can cross several operators.",
    'guide.internet.part.provider.impact': "Network congestion, line faults or an issue in the provider network can slow many websites and apps at once.",
    'guide.internet.part.dns.kicker': "NAME LOOKUP",
    'guide.internet.part.dns.title': "DNS helps find the website address",
    'guide.internet.part.dns.description': "The Domain Name System helps match a name such as example.com with the IP address used to reach the service. A saved answer may be reused, so a new lookup is not always needed.",
    'guide.internet.part.dns.impact': "A DNS problem can stop a name from resolving even when your internet connection itself is working.",
    'guide.internet.part.server.kicker': "DESTINATION",
    'guide.internet.part.server.title': "The website service sends the page data",
    'guide.internet.part.server.description': "The request reaches the website service. It returns the files and information your browser needs. A nearby cache or content delivery network may serve some files.",
    'guide.internet.part.server.impact': "A busy or distant server, large page files or a slow service can make one website slow while other sites work normally.",
    'guide.journey.lede': "You tap a link. A moment later, a website appears. Let's follow that request through the network, one step at a time—without the technical fog.",
    'guide.journey.intro': "Imagine opening a website on your phone at home. Select Next step to follow the request from your device to the website, then watch the response travel back.",
    'guide.journey.node.device': "Your device",
    'guide.journey.node.device.help': "Asks for a page",
    'guide.journey.node.wifi': "Wi-Fi or cable",
    'guide.journey.node.wifi.help': "Local connection",
    'guide.journey.node.router': "Home router",
    'guide.journey.node.router.help': "Forwards traffic",
    'guide.journey.node.provider': "Internet provider",
    'guide.journey.node.provider.help': "Connects networks",
    'guide.journey.node.dns': "DNS lookup",
    'guide.journey.node.dns.help': "Finds the address",
    'guide.journey.node.server': "Website server",
    'guide.journey.node.server.help': "Sends page data",
    'guide.journey.flow.request': "REQUEST travels towards the website →",
    'guide.journey.flow.response': "← RESPONSE returns to your device",
    'guide.journey.progress': "Journey progress",
    'guide.journey.packet.label': "A page is exchanged as many small pieces of data.",
    'guide.journey.dns_text': "People remember names such as tezzconnect.online. Computers use IP addresses to identify destinations on a network. The Domain Name System (DNS) helps translate a domain name into the address needed to find the service. Your device or network may already have a saved answer, so a fresh lookup is not always needed for every visit.",
    'guide.journey.related.basics.title': "Internet basics",
    'guide.journey.related.basics.description': "Understand the main parts of the internet.",
    'guide.journey.related.speed.title': "Internet speed explained",
    'guide.journey.related.speed.description': "Learn what Mbps and bandwidth mean.",
    'guide.journey.related.latency.title': "Latency and jitter",
    'guide.journey.related.latency.description': "See why response time and consistency matter.",
    'guide.journey.related.glossary.title': "Networking glossary",
    'guide.journey.related.glossary.description': "Look up terms such as DNS, router, IP address and packet.",
    'guide.journey.related.glossary.read': "Explore the glossary →",
    'guide.journey.roadmap': "Continue with the full Internet Learning Roadmap →",
    'guide.journey.meta': "TEZZ CONNECT · Interactive visual guide",
    'guide.journey.eyebrow': "VISUAL LEARNING · BEGINNER",
    'guide.journey.interactive': "INTERACTIVE NETWORK JOURNEY",
    'guide.journey.quiz.eyebrow': "QUICK KNOWLEDGE CHECK",
    'guide.journey.related.eyebrow': "KEEP LEARNING",
    'guide.journey.breadcrumb.roadmap': "Learning roadmap",
    'guide.journey.breadcrumb.hub': "Internet Knowledge Hub",
    'guide.journey.roadmap': "Continue with the full Internet Learning Roadmap →",
    'guide.journey.network_text': "The internet is a network of networks. Your home network connects to your provider, and your provider connects with other networks. Information can cross many different networks before reaching its destination.",
    'guide.journey.step.0.title': "Your device makes a request",
    'guide.journey.step.0.description': "You type a website name or tap a link. Your browser needs to find the computer or service that can provide that page.",
    'guide.journey.step.0.analogy': "Think of writing the name of a place on a parcel before sending it.",
    'guide.journey.step.0.status': "Your browser has a destination in mind.",
    'guide.journey.step.1.title': "Your device joins the local network",
    'guide.journey.step.1.description': "Your phone sends data over Wi-Fi, or your laptop sends it through an Ethernet cable. This gets the request from your device to your home network.",
    'guide.journey.step.1.analogy': "Wi-Fi is the local road from your device to the router. It is not the whole internet.",
    'guide.journey.step.1.status': "The request is moving across your home connection.",
    'guide.journey.step.2.title': "Your router forwards the traffic",
    'guide.journey.step.2.description': "The router connects your home devices and forwards traffic towards your internet connection. It also helps send returning information to the correct device.",
    'guide.journey.step.2.analogy': "A router is like a building's mailroom: it helps direct incoming and outgoing items to the right place.",
    'guide.journey.step.2.status': "Your router is passing the request onwards.",
    'guide.journey.step.3.title': "Your internet provider connects networks",
    'guide.journey.step.3.description': "Your internet service provider carries traffic from your connection into its network and towards other networks. The route may pass through several network operators.",
    'guide.journey.step.3.analogy': "Think of changing from a local street to a larger road network. There can be several routes to the destination.",
    'guide.journey.step.3.status': "The request is travelling across connected networks.",
    'guide.journey.step.4.title': "DNS helps find the website address",
    'guide.journey.step.4.description': "The Domain Name System helps look up the IP address associated with the website name. Your device or network may already have a cached answer, so a new lookup is not always necessary.",
    'guide.journey.step.4.analogy': "DNS works a little like looking up a person's name in a contacts list to find the number to call.",
    'guide.journey.step.4.status': "The destination name can now be matched to a network address.",
    'guide.journey.step.5.title': "The website server receives the request",
    'guide.journey.step.5.description': "The request reaches the service hosting the website. The server prepares the information your browser needs. A nearby cache or content delivery network may handle some files instead.",
    'guide.journey.step.5.analogy': "The destination has received your request and is preparing the reply.",
    'guide.journey.step.5.status': "The website is preparing the response.",
    'guide.journey.step.6.title': "The page data travels back",
    'guide.journey.step.6.description': "The server sends the required data back through networks towards your device. Data is commonly split into packets, and the receiving systems process the pieces.",
    'guide.journey.step.6.analogy': "Instead of one enormous parcel, imagine the page arriving as several labelled packages.",
    'guide.journey.step.6.status': "The response is travelling back towards your home.",
    'guide.journey.step.7.title': "Your browser builds the page",
    'guide.journey.step.7.description': "Your device receives the resources and your browser puts the text, images, styles and other page parts together. The website appears on your screen.",
    'guide.journey.step.7.analogy': "Your browser is like the person unpacking the delivered pieces and assembling the finished item.",
    'guide.journey.step.7.status': "Journey complete. You can restart or revisit any step.",
    'guide.speed.body.mbps_intro': "Internet speed tells you how quickly data can move between your device and another point on the internet. You will usually see it written as Mbps, which means megabits per second.",
    'guide.speed.body.units': "Here is an easy way to understand the units: internet plans use megabits (Mb), while file sizes are often shown in megabytes (MB). Eight bits make one byte. So, 100 Mbps works out to a theoretical maximum of about 12.5 MB per second, before normal network overhead and other limits.",
    'guide.speed.body.snapshot': "A speed test is a snapshot. It measures your connection to a particular test server at that moment. It does not mean every app, game or website will run at that exact rate.",
    'guide.speed.body.download': "Download speed is how quickly information comes to your device. You use it when you watch a video, open a website, download an app or receive a file.",
    'guide.speed.body.upload': "Upload speed is how quickly information goes from your device to the internet. You use it when you send photos, back up files, share your screen or speak on a video call.",
    'guide.speed.body.example': "For example, watching a movie mostly uses download speed. Sending a large video to a friend mostly uses upload speed. A video call uses both because you receive the other person's video and send your own.",
    'guide.speed.body.needs_intro': "There is no magic number that suits every home. It depends on how many people are online, what they are doing and whether several activities happen at the same time. Use this as a simple starting point, not as a guaranteed minimum:",
    'guide.speed.body.planner_intro': "Choose the activities happening at the same time. The planner estimates a useful starting point for download and upload capacity, with extra room for normal variation.",
    'guide.speed.body.test_intro': "If you want to know whether your connection is performing well, try to make the test fair:",
    'guide.speed.body.test_variation': "If the result changes a lot, look for a pattern. A single low result does not automatically mean your provider is at fault. The device, Wi-Fi signal, busy home network, test server and route can all make a difference.",
    'guide.speed.body.read_intro': "A speed test is useful when you treat it as a measurement under specific conditions, rather than a permanent rating for your broadband. The result reflects the device, connection type, test server, route and network activity at the time you ran it. Two tests can disagree without either one being broken.",
    'guide.speed.body.measure': "TEZZ CONNECT measures download and upload throughput using its own test endpoints. Its latency and jitter figures are based on HTTP request-and-response timing to the TEZZ network edge; they are not ICMP ping measurements. Results can change with your device, network and route.",
    'guide.speed.planner.explanation': "Suggested starting point includes about 30% planning headroom. It is not a guaranteed minimum.",
    'guide.speed.planner.breakdown': "Estimated active demand: ",
    'guide.speed.quiz.choose_first': "Choose an answer first, then check it.",
    'guide.speed.quiz.correct': "Correct! ",
    'guide.speed.quiz.not_quite': "Not quite. ",
    'guide.speed.faq.q1': "Is 100 Mbps the same as 100 MB per second?",
    'guide.speed.faq.a1': "No. Mbps means megabits per second; MB/s means megabytes per second. Since one byte contains eight bits, 100 Mbps is a theoretical maximum of 12.5 MB/s before protocol overhead and other limits. A real download may be lower.",
    'guide.speed.faq.q2': "Why does my download speed change during the day?",
    'guide.speed.faq.a2': "Wi-Fi conditions, household activity, provider network demand, the test server and the route can all change. Repeat the test at different times with the same device and method. A consistent pattern is more useful than one isolated result.",
    'guide.speed.faq.q3': "Will a faster plan fix buffering?",
    'guide.speed.faq.a3': "It may help if your current connection does not have enough throughput for the video quality and other simultaneous activities. But buffering can also come from Wi-Fi problems, device performance, a busy streaming service or a network route. Check the cause before upgrading.",
    'guide.speed.faq.q4': "Why is my speed test good but one website slow?",
    'guide.speed.faq.a4': "A speed test measures a connection to its own server. A particular website may be farther away, busy, or affected by its own hosting, routing or browser issues. Try another website and device, and check whether the problem is limited to one service.",
    'guide.speed.faq.q5': "How many speed tests should I run?",
    'guide.speed.faq.a5': "For a quick check, run two or three tests under similar conditions. If you are troubleshooting, repeat at different times and compare Wi-Fi with Ethernet where possible. Avoid running many tests back-to-back while other devices are using the connection, because the tests themselves consume bandwidth.",
    'guide.speed.faq.q6': "Should I choose my internet plan based only on download speed?",
    'guide.speed.faq.a6': "No. Consider upload speed, the number of people and devices in your home, the activities you do at the same time, data limits, reliability and the technology available at your address. For gaming and calls, latency and stability also matter.",
    'guide.speed.faq.q7': "Is 100 Mbps fast enough for a family?",
    'guide.speed.faq.a7': "It can be enough for many homes, but it depends on how many people stream, join video calls, download files and use the internet at the same time. Use the household planner above as a starting point, then compare it with your real usage.",
    'guide.speed.faq.q8': "Why is my download speed lower than my internet plan?",
    'guide.speed.faq.a8': "Wi-Fi signal, distance from the router, device limits, network congestion, background downloads and the test server can all affect a result. Test more than once and compare Wi-Fi with Ethernet if possible.",
    'guide.speed.faq.q9': "Does upload speed matter?",
    'guide.speed.faq.a9': "Yes. Upload speed affects sending files, cloud backups, live streaming and the video or audio you send during online meetings.",
    'guide.speed.faq.q10': "Are Mbps and MB/s the same?",
    'guide.speed.faq.a10': "No. Mbps means megabits per second, while MB/s means megabytes per second. One byte contains eight bits, so divide Mbps by eight for a theoretical MB/s figure before allowing for network overhead.",
    'guide.speed.body.transfer_intro': "Enter the file size and your internet speed to get a rough time estimate. This is useful when downloading a game, saving a large video, backing up photos or sending work files.",
    'guide.speed.body.read_directions': "Compare each result with the corresponding rate in your broadband plan. Some plans are asymmetric, so the upload rate may be lower by design. If downloads are close to the plan's expected performance but uploads are consistently poor, investigate the upstream side rather than assuming the whole connection is slow.",
    'guide.speed.body.read_latency': "Latency is about waiting time, not how much data can move each second. It can affect how responsive a website, game or video call feels. A connection can deliver a large file quickly but still feel sluggish when small requests take a long time to get a response. Read more in our guide to latency, ping and jitter.",
    'guide.speed.body.read_jitter': "Jitter describes variation in packet or response timing, depending on the measurement method. Packet loss means some data does not arrive at its destination. These issues can disrupt real-time activities even when average download speed looks healthy. Not every browser speed test measures packet loss or network jitter directly, so check what the tool actually reports.",
    'guide.speed.body.read_consistency': "For a meaningful comparison, keep the device, test service, server and connection type as consistent as possible. If you are investigating a problem, change one condition at a time and write down what changed.",
    'guide.speed.body.upgrade_explain': "No. A higher plan can increase the amount of data your connection can transfer at once, which helps when several people are streaming, downloading or uploading. But it does not automatically shorten the physical route to a server, improve a weak Wi-Fi signal, remove packet loss or fix a busy remote service.",
    'guide.speed.body.upgrade_bottleneck': "Think about the bottleneck. If your household regularly uses all the available bandwidth, a faster plan may help. If the problem happens only in one room, on one device or with one online service, upgrading the plan may not solve it. First compare wired and wireless results, try more than one destination and check whether the issue appears at busy times.",
    'guide.speed.body.bandwidth_explain': "People often use “internet speed” to describe several different measurements. In technical terms, bandwidth is the capacity of a connection, throughput is the data rate actually achieved, and latency is the time taken for a response. They work together, but they answer different questions.",
    'guide.speed.body.bandwidth_context': "This distinction helps explain why a speed-test number alone cannot describe the entire quality of an internet connection. For example, a video call needs enough throughput in both directions, but it also benefits from low delay, low variation and minimal packet loss.",
    'guide.speed.body.tool_intro': "Run the free TEZZ CONNECT test and compare your download and upload results.",
    'guide.speed.body.related_intro': "Build on this topic with these practical TEZZ CONNECT guides.",
    'guide.speed.body.quiz_feedback': "Correct. Eight bits make one byte, so 100 Mbps is theoretically about 12.5 MB/s before overhead and other limits.",
    'guide.speed.table.activity': "What you're doing",
    'guide.speed.table.note': "What to keep in mind",
    'guide.speed.table.browse': "Browsing and email",
    'guide.speed.table.browse_note': "These usually need less bandwidth. A stable connection often matters more than a very high plan.",
    'guide.speed.table.hd': "HD video",
    'guide.speed.table.hd_note': "Allow enough download capacity for each stream, plus room for other people using the connection.",
    'guide.speed.table.4k': "4K video",
    'guide.speed.table.4k_note': "Needs more steady download capacity than HD. Check the streaming service's current recommendation.",
    'guide.speed.table.meet': "Video meetings",
    'guide.speed.table.meet_note': "Both download and upload matter. A steady connection helps avoid frozen video and broken audio.",
    'guide.speed.table.cloud': "Cloud backup and file sharing",
    'guide.speed.table.cloud_note': "Upload speed matters, especially when sending large files.",
    'guide.speed.table.game': "Online gaming",
    'guide.speed.table.game_note': "Fast downloads help with updates, but response time and connection stability can matter more during a match.",
    'guide.speed.planner.eyebrow': "INTERACTIVE HOUSEHOLD PLANNER",
    'guide.speed.planner.hd': "HD video streams",
    'guide.speed.planner.hd_help': "Illustrative allowance: 5 Mbps download each",
    'guide.speed.planner.4k': "4K video streams",
    'guide.speed.planner.4k_help': "Illustrative allowance: 25 Mbps download each",
    'guide.speed.planner.calls': "Video calls",
    'guide.speed.planner.calls_help': "Planning allowance: 4 Mbps down and 3 Mbps up each",
    'guide.speed.planner.uploads': "Large file uploads in progress",
    'guide.speed.planner.uploads_help': "Illustrative allowance: 8 Mbps upload each",
    'guide.speed.planner.start': "ESTIMATED STARTING POINT",
    'guide.speed.planner.down': "Mbps download",
    'guide.speed.planner.up': "Mbps upload",
    'guide.speed.planner.disclaimer': "These are simple planning assumptions, not official minimums or a guarantee. Actual requirements vary by app, video quality, device, Wi-Fi conditions and simultaneous activity. Check the service provider's recommendations for your apps. Gaming is often more sensitive to latency and stability than raw bandwidth.",
    'guide.speed.planner.important': "Important",
    'guide.speed.transfer.eyebrow': "FREE INTERACTIVE SPEED CALCULATOR",
    'guide.speed.transfer.speed_label': "Your ",
    'guide.speed.transfer.speed_suffix': " speed (Mbps)",
    'guide.speed.transfer.result_label': "ESTIMATED TIME",
    'guide.speed.transfer.explanation': "At 100 Mbps, a 2 GB download is estimated at about 3 minutes 20 seconds using the stated 80% planning allowance.",
    'guide.speed.transfer.note': "The estimate allows for about 80% of the entered speed being available for file data. Real transfers can take longer.",
    'guide.speed.transfer.tip_title': "Quick tip:",
    'guide.speed.transfer.tip': "A 100 Mbps plan does not mean 100 MB downloads every second. Mbps is megabits; MB is megabytes. There are 8 bits in 1 byte.",
    'guide.speed.transfer.speed_download': "download",
    'guide.speed.transfer.speed_upload': "upload",
    'guide.speed.test.step1': "Pause large downloads, backups and video streams if you can.",
    'guide.speed.test.step2': "Use one device for the test. If possible, connect it to the router with an Ethernet cable.",
    'guide.speed.test.step3': "If you're testing Wi-Fi, stand reasonably close to the router.",
    'guide.speed.test.step4': "Run the test a few times, including at a different time of day.",
    'guide.speed.test.step5': "Write down whether you used Wi-Fi or Ethernet and which device you tested.",
    'guide.speed.quiz.question': "Your plan shows 100 Mbps. A file download does not show 100 MB every second. Is that automatically a problem?",
    'guide.speed.quiz.option0': "Yes. Mbps and MB/s are identical.",
    'guide.speed.quiz.option1': "No. Mbps measures megabits; MB/s measures megabytes. Eight bits make one byte.",
    'guide.speed.quiz.option2': "Yes. Your router must be replaced.",
    'guide.speed.quiz.button': "Check my answer",
    'guide.speed.related.card1.title': "Upload speed explained",
    'guide.speed.related.card1.desc': "Understand the data your devices send upstream.",
    'guide.speed.related.card2.title': "Internet speed for gaming",
    'guide.speed.related.card2.desc': "See why stable response time matters in games.",
    'guide.speed.related.card3.title': "What is the internet?",
    'guide.speed.related.card3.desc': "Start with the networks behind your connection.",
    'guide.speed.related.read': "Read guide →",
    'guide.internet.title': "What is the internet and how does it work?",
    'guide.internet.lede': "The internet can feel invisible: you tap a link and a page appears. Behind that simple action is a worldwide system of connected networks, routers, cables, wireless links and computers that exchange data.",
    'guide.internet.toc.1': "What the internet actually is",
    'guide.internet.toc.2': "What happens when you open a website?",
    'guide.internet.toc.3': "Modem, router and Wi-Fi explained",
    'guide.internet.toc.4': "What your internet provider does",
    'guide.internet.toc.5': "How data travels in packets",
    'guide.internet.toc.6': "What affects internet speed?",
    'guide.internet.toc.7': "Key points to remember",
    'guide.internet.heading.definition': "So, what exactly is the internet?",
    'guide.internet.heading.explorer': "Explore the parts of a connection",
    'guide.internet.body.explorer': "Choose a part of the journey. The explanation below changes to show what it does and what can go wrong.",
    'guide.internet.heading.journey': "What happens when you open a website?",
    'guide.internet.body.journey': "Imagine you type a website name into your browser and press Enter. A few things happen very quickly:",
    'guide.internet.heading.equipment': "Modem, router and Wi-Fi: what do they do?",
    'guide.internet.heading.providers': "What does your internet provider do?",
    'guide.internet.heading.packets': "How does information travel?",
    'guide.internet.heading.slow': "Why can your internet feel slow?",
    'guide.internet.heading.takeaways': "The simple version to remember",
    'guide.internet.heading.try': "Try it on your own connection",
    'guide.internet.heading.check': "Want to check your connection?",
    'guide.internet.heading.quiz': "Try it yourself",
    'guide.internet.heading.related': "Keep learning",
    'guide.internet.body.definition.1': "Think of the internet as a huge system of roads connecting computers and devices all over the world. Your phone, your internet provider, a website's computer and millions of other networks are all connected in some way. These connected networks let information travel from one place to another.",
    'guide.internet.body.definition.2': "The internet is not one giant computer in one building. It is made up of many networks run by different organisations. They work together so you can send a message, watch a video, make a payment or visit a website.",
    'guide.internet.body.definition.3': "One useful difference: the internet is the network itself. The web is the collection of websites and pages you open in a browser. Email, online games and video calls also use the internet, but they are not websites.",
    'guide.internet.caption.journey': "A simplified look at how a website request travels from your device to a server and back. The real route can be different.",
    'guide.internet.takeaway.1': "The internet is a worldwide network made up of many connected networks.",
    'guide.internet.takeaway.2': "Websites, email, video calls and games are services that use the internet.",
    'guide.internet.takeaway.3': "Your router connects your home devices; Wi-Fi is just one way they connect to it.",
    'guide.internet.takeaway.4': "DNS helps your device find the right website address.",
    'guide.internet.takeaway.5': "Real-world speed depends on more than the plan you pay for.",
    'guide.internet.explorer.label': "Choose a network component",
    'guide.internet.explorer.device': "Your device",
    'guide.internet.explorer.device.help': "Phone, laptop or TV",
    'guide.internet.explorer.wifi': "Wi-Fi / Ethernet",
    'guide.internet.explorer.wifi.help': "Your local connection",
    'guide.internet.explorer.router': "Router",
    'guide.internet.explorer.router.help': "Directs home traffic",
    'guide.internet.explorer.provider': "Internet provider",
    'guide.internet.explorer.provider.help': "Connects networks",
    'guide.internet.explorer.dns': "DNS",
    'guide.internet.explorer.dns.help': "Finds the destination",
    'guide.internet.explorer.server': "Website server",
    'guide.internet.explorer.server.help': "Returns page data",
    'guide.internet.explorer.impact': "What can affect it?",
    'guide.internet.explorer.footnote': "This is a simplified learning model. DNS lookups can happen at different points, and real traffic may use caches or nearby content servers.",
    'guide.internet.body.speed.wifi': "Wi-Fi signal: distance, thick walls, floors and interference can weaken the wireless connection.",
    'guide.internet.body.speed.devices': "Too many active devices: several people streaming, gaming or downloading at once can share the available capacity.",
    'guide.internet.body.speed.device': "Your device: an older phone, laptop or network adapter may not be able to use the full connection speed.",
    'guide.internet.body.speed.provider': "Your provider's network: busy networks can sometimes slow things down.",
    'guide.internet.body.speed.website': "The website or service: a slow server or a long route can make one website feel slow even when other sites work well.",
    'guide.internet.body.speed.response': "Response delays: a connection can download files quickly but still take longer to respond when you click or play a game.",
    'guide.internet.body.speed.test': "To start checking, run a speed test near your router. If possible, compare it with a wired Ethernet test and repeat at another time. TEZZ CONNECT measures your browser's connection to a TEZZ test endpoint. It is a useful snapshot of that route—not a promise of the speed every website will deliver.",
    'guide.internet.body.try': "Run a test near your router, then try again from the room where you usually use the internet. Note whether you used Wi-Fi or a cable. That small comparison can help you spot a home Wi-Fi issue.",
    'guide.internet.body.check': "Use the free TEZZ CONNECT test to see download speed, upload speed and browser response-time estimates.",
    'guide.internet.cta.speed': "Open TEZZ CONNECT speed test →",
    'guide.internet.quiz.question': "You turn off your home internet service, but your phone and wireless printer can still connect to the same Wi-Fi router. Why?",
    'guide.internet.quiz.legend': "Choose one answer",
    'guide.internet.quiz.option.0': "Wi-Fi and the internet are exactly the same thing.",
    'guide.internet.quiz.option.1': "Wi-Fi connects devices locally; the internet is a separate connection beyond your home network.",
    'guide.internet.quiz.option.2': "Your printer is secretly using mobile data.",
    'guide.internet.quiz.check': "Check my answer",
    'guide.internet.quiz.noscript': "JavaScript is needed to check your answer interactively. The guide above contains the explanation.",
    'guide.internet.related.intro': "Build on this topic with these practical TEZZ CONNECT guides.",
    'guide.internet.related.speed.title': "Internet speed explained",
    'guide.internet.related.speed.description': "Understand bandwidth, downloads and uploads.",
    'guide.internet.related.wifi.title': "Improve Wi-Fi speed",
    'guide.internet.related.wifi.description': "Work through practical coverage and connection checks.",
    'guide.internet.related.latency.title': "Latency, ping and jitter",
    'guide.internet.related.latency.description': "Learn why response time matters.",
    'guide.internet.related.read': "Read guide →",
    'guide.internet.body.journey.device': "Your device connects. Your phone or laptop uses Wi-Fi, an Ethernet cable or mobile data to reach a network.",
    'guide.internet.body.journey.dns': "The website name is looked up. DNS (the Domain Name System) works a bit like your phone's contacts list. It helps find the network address linked to a name such as example.com.",
    'guide.internet.body.journey.route': "Your request travels across networks. Your router and internet provider help send the request towards the computer that hosts the website. The route can vary.",
    'guide.internet.body.journey.reply': "The website sends information back. The server replies with the files needed for the page.",
    'guide.internet.body.journey.browser': "Your browser puts the page together. It uses those files—text, pictures, styles and other parts—to show the website on your screen.",
    'guide.internet.body.cdn': "This is the simple version. Large websites may use several servers, saved copies of files (caches) and content delivery networks to load pages faster.",
    'guide.internet.equipment.modem': "Modem or fibre ONT",
    'guide.internet.body.modem': "This is the equipment that connects your home to the provider's network. Cable or DSL services often use a modem. Fibre services commonly use a device called an ONT. Sometimes these parts are built into one box with the router.",
    'guide.internet.equipment.router': "Router",
    'guide.internet.body.router': "Your router connects the devices in your home to each other and to the internet. It directs information to the right device. Many home routers also provide Wi-Fi and have Ethernet ports for wired connections.",
    'guide.internet.equipment.wifi': "Wi-Fi",
    'guide.internet.body.wifi': "Wi-Fi is simply a wireless way for your phone, laptop or TV to connect to your home network. It is not the internet itself. For example, your phone may still connect to your printer over Wi-Fi even if your internet provider has an outage.",
    'guide.internet.body.isp': "Your internet service provider (ISP) connects your home or office to its network and helps your data reach other networks. It may use fibre, cable, DSL, fixed wireless or a mobile network to provide the connection.",
    'guide.internet.body.plan': "The speed written on your plan is the service level you have subscribed to. It does not mean every app or website will always run at exactly that speed. Your Wi-Fi, device, network traffic, website server and the route your data takes can all affect what you experience.",
    'guide.internet.body.packets': "When you send a photo or open a website, the information is usually broken into smaller pieces called packets. Think of sending a large parcel as several smaller packages. Network equipment reads the address information on each packet and forwards it towards the right destination.",
    'guide.internet.body.reassembly': "The receiving device puts the pieces back together. Some types of internet traffic can resend missing pieces; other types use different methods because speed or timing matters more. You do not need to manage any of this yourself—your devices and network handle it.",
    'guide.speed.caption.directions': "Download brings information to your device. Upload sends information from your device. The illustration is simplified.",
    'guide.speed.read.latency_heading': "Latency: how quickly does a response come back?",
    'guide.speed.body.latency': "Latency is about waiting time, not how much data can move each second. It can affect how responsive a website, game or video call feels. A connection can deliver a large file quickly but still feel sluggish when small requests take a long time to get a response. Read more in our guide to latency, ping and jitter.",
    'guide.speed.read.jitter_heading': "Jitter and packet loss: is the connection consistent?",
    'guide.speed.read.variation_heading': "Why one test may show a different result from another",
    'guide.speed.read.server': "Different test servers: each server may be in a different location or have a different capacity.",
    'guide.speed.read.wifi': "Wi-Fi versus Ethernet: wireless interference and signal strength can change the result.",
    'guide.speed.read.activity': "Other activity: cloud backups, streaming and downloads share your connection.",
    'guide.speed.read.device': "Device limits: older hardware, browser extensions or background tasks may affect testing.",
    'guide.speed.read.time': "Time of day: local network demand and wider provider traffic can vary.",
    'guide.speed.read.bandwidth': "Bandwidth: how much data a connection could carry under suitable conditions.",
    'guide.speed.read.throughput': "Throughput: how much data is actually transferred per second in a particular test or activity.",
    'guide.speed.read.latency_term': "Latency: how long a request takes to receive a response.",
    'guide.speed.read.jitter_term': "Jitter: how much packet or response timing varies.",
    'guide.speed.read.loss': "Packet loss: the share of packets that fail to reach their destination.",
    'guide.speed.quiz.noscript': "JavaScript is needed to check your answer interactively. The guide above contains the explanation.",
    'guide.speed.faq.heading': "Common questions about internet speed",
  };

  const originalMetadata = {
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.content || '',
    ogTitle: document.querySelector('meta[property="og:title"]')?.content || '',
    ogDescription: document.querySelector('meta[property="og:description"]')?.content || '',
    twitterTitle: document.querySelector('meta[name="twitter:title"]')?.content || '',
    twitterDescription: document.querySelector('meta[name="twitter:description"]')?.content || ''
  };
  function applyLocalizedMetadata() {
    if (window.location.pathname !== '/') return;
    const meta = (localeBundles[language] || {})._meta || {};
    document.title = language !== 'en' && meta.title ? meta.title : originalMetadata.title;
    const values = [
      ['meta[name="description"]', meta.description, originalMetadata.description],
      ['meta[property="og:title"]', meta.title, originalMetadata.ogTitle],
      ['meta[property="og:description"]', meta.description, originalMetadata.ogDescription],
      ['meta[name="twitter:title"]', meta.title, originalMetadata.twitterTitle],
      ['meta[name="twitter:description"]', meta.description, originalMetadata.twitterDescription]
    ];
    values.forEach(([selector, translated, original]) => {
      const element = document.querySelector(selector);
      if (element) element.setAttribute('content', language !== 'en' && translated ? translated : original);
    });
  }
  const attributeNames = ['aria-label', 'aria-description', 'placeholder', 'title', 'alt'];
  const originalAttributes = new WeakMap();

  function translationFor(key) {
    const bundle = localeBundles[language] || {};
    if (language !== 'en' && typeof bundle[key] === 'string') return bundle[key];
    return typeof sourceStrings[key] === 'string' ? sourceStrings[key] : key;
  }

  function applyKeyedTranslations(root) {
    if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
    const elements = [];
    if (root.matches && root.matches('[data-i18n], [data-i18n-aria-label], [data-i18n-aria-description], [data-i18n-placeholder], [data-i18n-title], [data-i18n-alt]')) elements.push(root);
    if (root.querySelectorAll) elements.push(...root.querySelectorAll('[data-i18n], [data-i18n-aria-label], [data-i18n-aria-description], [data-i18n-placeholder], [data-i18n-title], [data-i18n-alt]'));
    elements.forEach(element => {
      if (element.hasAttribute('data-i18n')) {
        const key = element.getAttribute('data-i18n');
        if (key && !element.children.length) {
          if (!originals.has(element)) originals.set(element, element.textContent);
          const translated = language === 'en' ? originals.get(element) : translationFor(key);
          if (element.textContent !== translated) element.textContent = translated;
        }
      }
      attributeNames.forEach(attribute => {
        const dataName = 'data-i18n-' + attribute.replace(/^aria-/, 'aria-');
        if (!element.hasAttribute(dataName)) return;
        let saved = originalAttributes.get(element);
        if (!saved) { saved = Object.create(null); originalAttributes.set(element, saved); }
        if (!(attribute in saved)) saved[attribute] = element.getAttribute(attribute) || '';
        const key = element.getAttribute(dataName);
        const translated = language === 'en' ? saved[attribute] : translationFor(key);
        if (element.getAttribute(attribute) !== translated) element.setAttribute(attribute, translated);
      });
    });
  }
  function translateText(root) {
    if (language === 'en') {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (originals.has(node)) node.nodeValue = originals.get(node);
      }
      return;
    }
    const dictionary = localeBundles[language] || {};
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT|OPTION)$/i.test(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.closest('[data-no-translate],[data-i18n],script,style,code,pre')) return NodeFilter.FILTER_REJECT;
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
    label.setAttribute('data-i18n-aria-label', 'common.choose_language');
    label.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin-inline-start:12px;font:600 12px/1.2 system-ui,sans-serif;color:inherit;white-space:nowrap';
    const icon = document.createElement('span');
    icon.textContent = '文';
    icon.setAttribute('aria-hidden', 'true');
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Website language');
    select.setAttribute('data-i18n-aria-label', 'common.language');
    select.style.cssText = 'max-width:132px;padding:8px 26px 8px 9px;border:1px solid #6c8799;border-radius:9px;background:#10283e;color:#fff;font:600 12px system-ui,sans-serif';
    languages.forEach(item => {
      const option = document.createElement('option');
      option.value = item.code;
      option.textContent = item.nativeName || item.name;
      select.append(option);
    });
    select.value = language;
    select.addEventListener('change', () => { setLanguage(select.value); });
    label.append(icon, select);
    host.append(label);
  }
  async function setLanguage(next) {
    const requested = supported.has(next) ? next : 'en';
    if (requested !== 'en' && !localeBundles[requested]) {
      const locale = languages.find(item => item.code === requested);
      if (!locale || !locale.bundle) {
        language = requested;
      } else {
      try {
        const response = await fetch(locale.bundle, { credentials: 'same-origin' });
        if (!response.ok) throw new Error('Locale bundle unavailable');
        const bundle = await response.json();
        if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) throw new Error('Invalid locale bundle');
        localeBundles[requested] = bundle;
      } catch {
        const picker = document.querySelector('[data-tezz-language-picker] select');
        if (picker) picker.value = language;
        return;
      }
      }
    }
    language = requested;
    try { localStorage.setItem(KEY, language); } catch {}
    document.documentElement.lang = language;
    document.documentElement.dir = directions.get(language) || 'ltr';
    applyLocalizedMetadata();
    const picker = document.querySelector('[data-tezz-language-picker] select');
    if (picker) picker.value = language;
    translateText(document.body);
    applyKeyedTranslations(document.body);
    document.dispatchEvent(new CustomEvent('tezz-language-change', { detail: { language } }));
  }
  async function loadLocaleManifest() {
    try {
      const response = await fetch('/locales/manifest.json', { credentials: 'same-origin', cache: 'no-cache' });
      if (!response.ok) return;
      const manifest = await response.json();
      if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.locales)) return;
      const valid = manifest.locales.filter(item =>
        item && typeof item.code === 'string' &&
        /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-[A-Z]{2}|-[0-9]{3})?$/.test(item.code) &&
        typeof item.nativeName === 'string' && item.nativeName.trim() &&
        ['ltr', 'rtl'].includes(item.direction || 'ltr') &&
        item.status === 'published' &&
        (item.code === 'en' || (typeof item.bundle === 'string' && item.bundle.startsWith('/locales/') && !item.bundle.includes('..')))
      );
      if (!valid.some(item => item.code === 'en')) return;
      languages = valid.map(item => ({
        code: item.code,
        name: item.name || item.nativeName,
        nativeName: item.nativeName,
        direction: item.direction || 'ltr',
        bundle: item.bundle || null
      }));
      supported = new Set(languages.map(item => item.code));
      directions = new Map(languages.map(item => [item.code, item.direction]));
      if (window.TEZZLanguage) window.TEZZLanguage.languages = languages;
    } catch {
      // Keep the embedded starter registry if the static manifest is unavailable.
    }
  }
  async function init() {
    await loadLocaleManifest();
    const savedLanguage = readLanguage();
    language = 'en';
    if (savedLanguage !== 'en') await setLanguage(savedLanguage);
    else {
      try {
        const response = await fetch('/locale-country', { credentials: 'same-origin', cache: 'no-store' });
        if (response.ok) {
          const { country } = await response.json();
          const countryLocale = country === 'CN' ? 'zh-CN' : country === 'BR' ? 'pt-BR' :
            ['ES','MX','AR','BO','CL','CO','CR','CU','DO','EC','SV','GT','HN','NI','PA','PY','PE','PR','UY','VE'].includes(country) ? 'es' :
            country === 'FR' ? 'fr' : ['DZ','BH','KM','DJ','EG','IQ','JO','KW','LB','LY','MR','MA','OM','PS','QA','SA','SO','SD','SY','TN','AE','YE'].includes(country) ? 'ar' : 'en';
          if (countryLocale !== 'en') await setLanguage(countryLocale);
        }
      } catch { /* Country detection is optional; English remains the fallback. */ }
    }
    document.documentElement.lang = language;
    document.documentElement.dir = directions.get(language) || 'ltr';
    applyLocalizedMetadata();
    addPicker();
    translateText(document.body);
    applyKeyedTranslations(document.body);
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'childList') record.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            translateText(node);
            applyKeyedTranslations(node);
          } else if (node.nodeType === Node.TEXT_NODE) {
            translateText(node.parentElement || document.body);
            applyKeyedTranslations(node.parentElement || document.body);
          }
        });
        else if (record.type === 'characterData') {
          translateText(record.target.parentElement || document.body);
          applyKeyedTranslations(record.target.parentElement || document.body);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('storage', event => {
      if (event.key === KEY) setLanguage(event.newValue || 'en');
    });
  }
  // Publish the helper synchronously so inline guide scripts can translate
  // their first render before DOMContentLoaded and the manifest fetch finish.
  window.TEZZLanguage = {
    setLanguage,
    getLanguage: () => language,
    getLanguages: () => languages.slice(),
    t: translationFor,
    apply: root => applyKeyedTranslations(root || document.body),
    languages
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();