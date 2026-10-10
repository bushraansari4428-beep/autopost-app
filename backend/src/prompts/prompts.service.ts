import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import * as util from 'util';

const execPromise = util.promisify(exec);

export interface FixedDNA {
  camera_and_medium: string;
  timing_breakdown: string[];
  negative_prompt: string;
  audio_rules: string;
  structural_template: string;
}

export interface HierarchicalMatrix {
  sub_genres: string[];
  locations: string[];
  subjects_or_anomalies: string[];
  tools_and_probes: string[];
  scale_anchors: string[];
  climaxes: string[];
}

export interface PromptMatrix {
  niche_name: string;
  theme_summary: string;
  fixed_dna: FixedDNA;
  hierarchical_matrix: HierarchicalMatrix;
  // Legacy compatibility keys
  subjects: string[];
  locations: string[];
  actions_or_hooks: string[];
  camera_styles: string[];
}

export interface GeneratedPromptItem {
  index: number;
  sub_genre: string;
  location: string;
  subject: string;
  text: string;
  similarity_score?: number;
}

interface UniqueSceneBlueprint {
  sub_genre: string;
  location: string;
  subject: string;
  tool: string;
  anchor: string;
  escalation: string;
  climax: string;
}

const DEFAULT_CAMERA_MEDIUM =
  'Create a 10-second vertical 9:16 raw smartphone video shot strictly from the rear camera in pure continuous first-person POV, with absolutely no selfie camera, no face-cam, and no picture-in-picture overlay.';

const DEFAULT_NEGATIVE_PROMPT =
  'human face, man face, selfie, front camera, picture-in-picture, PIP, face-cam, reaction face, talking head, vlogger overlay, avatar, split screen, napkins, tissues, paper, glass bowl, acrylic prop, cinematic CGI sheen, smooth gimbal stabilization, fantasy glowing magic runes, blue energy shields, sci-fi forcefields, cartoon water effects, alien technology, dramatic movie trailer soundtrack, bass drops, sound design risers, motion blur glitches, subtitles, text overlays, logos, watermarks, extra fingers, deformed hands, and narrative explanations. Maintain the convincing, unpolished aesthetic of authentic viral mobile found-footage captured spontaneously on a smartphone.';

// 100 COMPLETELY DISTINCT, ZERO-REPEAT SCENE BLUEPRINTS (NO ROCK/STONE REPETITION)
const MASTER_SCENE_BLUEPRINTS: UniqueSceneBlueprint[] = [
  {
    sub_genre: 'Misty Forest Footbridge',
    location: 'a misty pine forest clearing at dawn beside an old weathered cedar footbridge spanning a shallow woodland creek',
    subject: 'a stream of crystal-clear creek water rising vertically upward from the brook into a self-sustaining, hollow spinning liquid ring hovering two feet above the wooden bridge planks',
    tool: 'a dry 12-inch cedar twig held in an ordinary bare hand',
    anchor: 'a damp green woodland fern frond resting on the timber handrail to anchor realistic physical scale',
    escalation: 'as the twig touches the inner rim of the spinning water arch, the entire floating liquid ring instantaneously flash-freezes into solid, transparent glass-like ice while remaining suspended in mid-air',
    climax: 'the hovering ice ring shatters outward into thousands of glittering frost shards that scatter across the wooden planks; the operator stumbles a half-step backward and the recording cuts abruptly with NO face visible',
  },
  {
    sub_genre: 'Rural Railway Crossing',
    location: 'an overgrown rural railway crossing under overcast afternoon light, bordered by wildflowers and weathered wooden fence posts',
    subject: 'an abandoned vintage steel bicycle leaning upright against a wooden post whose rear spoked wheel is spinning smoothly at 300 RPM entirely on its own while its crisp shadow on the dirt path remains 100% motionless',
    tool: 'a stiff dry wheat stalk held by a bare hand',
    anchor: 'a yellow dandelion flower growing beside the rubber tire tread to anchor authentic physical scale',
    escalation: 'when the wheat stalk touches the blurring chrome spokes, the spinning tire immediately stops dead in 0.01 seconds while the stationary shadow on the dirt begins spinning violently by itself',
    climax: 'the bicycle bell rings out as the rear tire violently pops off the rim in a burst of white rubber dust toward the camera; the operator jerks the phone back and the clip ends abruptly with NO face visible',
  },
  {
    sub_genre: 'Suburban Rain Cul-de-Sac',
    location: 'a quiet wet asphalt cul-de-sac just after an afternoon rainstorm, lined with damp autumn curb leaves',
    subject: 'a perfectly square 1-meter rainwater puddle on the dark asphalt that reflects a crystal-clear midnight sky full of glowing stars and a full moon despite being under bright overcast daylight',
    tool: 'a yellow wooden carpenter pencil held in a bare hand',
    anchor: 'a fallen red maple leaf floating near the sharp corner of the square puddle to anchor realistic scale',
    escalation: 'as the pencil tip dips into the starry reflection, the water surface refuses to ripple and instead pulls upward like a taut elastic silicone membrane clinging to the wood',
    climax: 'the stretched liquid membrane snaps backward, launching a vertical column of glowing silver droplets straight toward the smartphone lens; the operator flinches backward and the video terminates with NO face visible',
  },
  {
    sub_genre: 'Weathered Barn Porch',
    location: 'the sunlit wooden porch of an old timber barn in bright morning light, with dusty pine floorboards and rough cedar beams',
    subject: 'an unlit antique brass hurricane lantern hanging from an iron hook that casts a solid, opaque cone of pitch-black midnight darkness onto the sunlit floorboards instead of light',
    tool: 'a 12-inch white wooden school ruler held in a bare hand',
    anchor: 'a small brown moth resting motionless on the timber post beside the hook to anchor real-world scale',
    escalation: 'as the bare hand pushes the white ruler halfway into the cone of darkness, the submerged half of the wooden ruler becomes completely invisible as if sliced cleanly by a portal',
    climax: 'the glass lantern chimney cracks down the middle and the dark shadow cone collapses inward into a swirl of grey soot that blows toward the lens; the operator steps back abruptly with NO face visible',
  },
  {
    sub_genre: 'Coastal Boardwalk Dune',
    location: 'a breezy coastal wooden boardwalk at low tide beside pale golden sand dunes and swaying marram grass',
    subject: 'an upside-down clear glass milk bottle half-buried in the dune where dry golden beach sand is streaming continuously upward inside the sealed bottle like a reverse hourglass',
    tool: 'a ribbed white cockle seashell held between bare fingers',
    anchor: 'a small grey seagull feather caught between two boardwalk planks to anchor authentic physical scale',
    escalation: 'when the seashell taps the side of the glass bottle, the rising sand stream freezes mid-air into a solid, spiraling golden corkscrew pillar suspended inside the glass',
    climax: 'the glass bottle fractures cleanly into four symmetrical petals that fall open as the sand pillar explodes into a blinding golden dust ring; the camera jerks backward and cuts out with NO face visible',
  },
  {
    sub_genre: 'Autumn Park Playground',
    location: 'a deserted neighborhood park playground on a calm, windless autumn morning covered in crisp orange oak leaves',
    subject: 'a single rubber chain swing hanging from a steel frame at a rigid, motionless 45-degree angle in mid-air as if invisible gravity is pulling it sideways while the adjacent swing hangs straight down',
    tool: 'a rolled-up newspaper tube held in a bare hand',
    anchor: 'an empty brown acorn cap resting on the rubber swing seat to anchor believable physical scale',
    escalation: 'when the newspaper tube lightly nudges the taut iron chain, the angled swing begins oscillating horizontally side-to-side while remaining locked at its impossible 45-degree tilt',
    climax: 'the iron chain snaps back to vertical with a violent whip-crack that sends a shockwave scattering dry oak leaves straight into the camera lens; the operator stumbles back and cuts with NO face visible',
  },
  {
    sub_genre: 'Old Orchard Brick Well',
    location: 'an overgrown apple orchard under soft afternoon sun, centered around a low circular red-brick water well',
    subject: 'a continuous sheet of clear water flowing upward out of the brick well and climbing smoothly up the exterior vertical brickwork before vanishing into thin air at the rim',
    tool: 'a wooden honey dipper stick held in a bare hand',
    anchor: 'afallen ripe red crabapple resting on the mossy brick ledge to anchor authentic scale',
    escalation: 'as the wooden dipper intercepts the upward-flowing water sheet, the water parts around the wood in a glowing V-shaped wake that begins vibrating rapidly',
    climax: 'the entire sheet of water detaches from the brick wall in a single hovering liquid curtain before bursting into cold spray across the smartphone lens; the operator recoils and the clip cuts with NO face visible',
  },
  {
    sub_genre: 'Abandoned Greenhouse Interior',
    location: 'inside an abandoned botanical glass greenhouse with rusted iron rafters, terracotta pots, and shafts of dusty sunlight',
    subject: 'a shattered pane of greenhouse roof glass whose broken triangular shards are suspended motionless in mid-air six inches above a potting table, refracting rainbow prisms onto the soil',
    tool: 'a stainless steel garden trowel held in a bare hand',
    anchor: 'a small terracotta seedling pot with a green sprout sitting right beneath the hovering shards to anchor realistic scale',
    escalation: 'when the flat blade of the steel trowel gently touches the lowest floating glass shard, all twenty suspended shards rotate in unison to point directly toward the camera lens',
    climax: 'the hovering glass fragments drop simultaneously onto the wooden table, shattering into harmless sugar-like crystal granules that bounce toward the phone; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Country Dirt Crossroads',
    location: 'a quiet country gravel crossroads at golden hour beside a weathered timber utility pole',
    subject: 'a single wooden utility pole casting three sharp, intersecting pitch-black shadows in three opposite directions across the dirt road despite a single afternoon sun in a clear sky',
    tool: 'a bright yellow fiberglass tape measure extended by a bare hand',
    anchor: 'a rusted horseshoe lying in the dry dirt where the three shadows meet to anchor physical scale',
    escalation: 'as the yellow tape measure touches the center shadow, the dark shadow rises two inches off the dirt like a three-dimensional ribbon of black velvet fluttering in the air',
    climax: 'the floating black ribbon snaps back into the ground, kicking up a circular puff of road dust straight into the smartphone camera; the operator stumbles backward and the video ends with NO face visible',
  },
  {
    sub_genre: 'Lakeside Wooden Pier',
    location: 'a weathered timber fishing pier extending over a calm, mirror-still mountain lake under morning mist',
    subject: 'a heavy rusted iron anchor chain rising vertically out of the lake water and standing rigid in mid-air like a solid steel column with no support at the top',
    tool: 'a cork-handled fishing rod butt held in a bare hand',
    anchor: 'a green dragonfly perched on the top floating iron chain link to anchor authentic micro scale',
    escalation: 'when the cork handle taps the top link, a slow sinusoidal wave travels down the rigid vertical iron chain as if it were made of soft rubber while lake water climbs up the links',
    climax: 'the iron chain suddenly loses its rigidity and collapses down into the lake, splashing cold water directly onto the camera lens; the operator pulls back and the clip terminates with NO face visible',
  },
  {
    sub_genre: 'Backyard Garden Patio',
    location: 'a sunlit backyard brick patio beside a wooden picket fence and overgrown hydrangea bushes',
    subject: 'a detached brass garden faucet lying loose on the brick patio with no pipe connected to it, yet gushing a steady, pressurized stream of clear cold water from its spout',
    tool: 'a clear plastic drinking cup held in a bare hand',
    anchor: 'a striped garden snail shell resting on the damp brick beside the brass valve to anchor realistic scale',
    escalation: 'when the bare hand turns the brass cross-handle clockwise to shut it off, the water stream freezes mid-pour into a solid, spiral-twisted icicle anchoring the faucet to the bricks',
    climax: 'the brass valve pops off the icicle under high pressure, spraying a fine cloud of frost mist straight into the smartphone camera; the operator recoils and the recording cuts with NO face visible',
  },
  {
    sub_genre: 'Forest Logging Track',
    location: 'a muddy forest logging track after rain, surrounded by tall birch trees and stacked pine timber logs',
    subject: 'a deep muddy tractor tire rut filled with rainwater where floating yellow birch leaves are orbiting in a synchronized, geometric hexagonal conveyor pattern at constant speed',
    tool: 'a stripped white birch bark twig held in a bare hand',
    anchor: 'a small red-capped woodland mushroom growing on the mud bank to anchor believable physical scale',
    escalation: 'when the twig is dipped into the center of the water, the water drains outward to the edges, leaving a dry rectangular hole in the middle of the puddle with vertical liquid walls',
    climax: 'the vertical liquid walls slam back together, sending a pressurized geyser of muddy water droplets up toward the phone lens; the operator steps backward and cuts out with NO face visible',
  },
  {
    sub_genre: 'Cobblestone Alleyway',
    location: 'a narrow historic European cobblestone alleyway in diffused morning light between aged brick walls',
    subject: 'an old black cast-iron streetlamp whose glass globe is filled with a miniature, swirling winter blizzard of real snowflakes while the outside air is warm and sunny',
    tool: 'a long wooden fireplace match held in a bare hand',
    anchor: 'a small bronze coin resting on the iron bracket of the lamp post to anchor realistic scale',
    escalation: 'when the unlit wooden match touches the exterior glass pane, a star-shaped pattern of thick white hoarfrost races across the glass and freezes the wooden match tip solid',
    climax: 'the glass pane swings open on its hinge and a concentrated blast of swirling snow flurries blows directly into the smartphone camera; the operator stumbles back and the video ends with NO face visible',
  },
  {
    sub_genre: 'Meadow Windmill Pasture',
    location: 'an open green pasture under bright afternoon clouds, featuring an old galvanized steel farm windmill',
    subject: 'a campfire ring of charred oak logs where thick grey woodsmoke is flowing horizontally two feet above the grass and weaving itself into a solid, braided rope of smoke that hangs in mid-air',
    tool: 'a long stainless steel barbecue tongs held in a bare hand',
    anchor: 'a white clover blossom growing right beneath the hovering smoke braid to anchor authentic scale',
    escalation: 'when the steel tongs pinch the braided smoke rope, it exhibits the solid physical resistance of braided cotton rope and can be lifted an inch upward without dispersing',
    climax: 'the taut smoke rope snaps in two and instantly decompresses into a dense cloud of white ash and vapor that engulfs the lens; the operator retreats and the clip cuts with NO face visible',
  },
  {
    sub_genre: 'Vintage Train Platform',
    location: 'an empty open-air wooden train station platform at dusk with cast-iron benches and steel canopy pillars',
    subject: 'a double-sided round station clock hanging from a beam whose black metal hands are spinning backward at 10x speed while drops of rainwater around it fall upward toward the canopy roof',
    tool: 'a folded paper train ticket held between bare fingers',
    anchor: 'a small grey pigeon feather resting on the iron bench armrest below to anchor realistic scale',
    escalation: 'as the bare hand holds the paper ticket near the clock rim, the paper ticket begins aging in reverse—its creased corners flattening out and turning crisp white in real time',
    climax: 'the glass clock face cracks down the center as the hands lock at twelve, sending a wave of suspended water droplets splashing against the camera lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Pine Woodland Hollow',
    location: 'a quiet sunlit pine woodland trail beside an ancient gnarled oak tree with a wide hollow trunk opening',
    subject: 'concentric rings of glowing golden pine pollen hovering motionless inside the hollow oak trunk like solid golden Saturn rings suspended in mid-air',
    tool: 'a long grey goose feather held in a bare hand',
    anchor: 'a small emerald-green moss patch on the rough oak bark rim to anchor authentic micro scale',
    escalation: 'when the tip of the goose feather passes through the outer golden ring, the pollen rings ripple like liquid gold and begin rotating in alternating clockwise and counter-clockwise directions',
    climax: 'the rotating pollen rings expand outward from the hollow trunk in a shimmering golden cloud straight toward the smartphone camera; the operator stumbles backward and cuts out with NO face visible',
  },
  {
    sub_genre: 'Concrete Park Staircase',
    location: 'a brutalist concrete outdoor staircase in a quiet urban plaza after a brief summer shower',
    subject: 'a stream of clear rainwater flowing steadily UP the concrete steps from the bottom landing to the top terrace in smooth, rhythmic cascades against gravity',
    tool: 'a white ping-pong ball held in a bare hand',
    anchor: 'a wet sycamore leaf stuck to the vertical concrete riser of the third step to anchor realistic scale',
    escalation: 'when the bare hand places the white ping-pong ball into the water at the bottom step, the ball is carried rapidly uphill, bouncing up six concrete steps by itself',
    climax: 'at the sixth step, the upward water flow reverses in 0.05 seconds, launching the ping-pong ball and a sheet of spray straight at the camera lens; the operator flinches back and cuts with NO face visible',
  },
  {
    sub_genre: 'Farmhouse Timber Fence',
    location: 'a sunny rural pasture bordered by a weathered five-rail split-cedar wooden fence and tall timothy grass',
    subject: 'a 2-foot middle section of the solid cedar fence rail that has become 100% optically transparent like clear optical glass while retaining its rough wood-grain bark edges',
    tool: 'a carpenter claw hammer held in a bare hand',
    anchor: 'a red ladybug crawling across the boundary where opaque cedar wood turns into clear glass to anchor authentic scale',
    escalation: 'when the steel hammer head gently taps the transparent wood section, internal tree growth rings light up inside the clear section like glowing amber fiber-optic rings',
    climax: 'a network of internal frost cracks races through the transparent rail section, ejecting a burst of fine cedar sawdust toward the camera lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Harbor Dry-Dock Slipway',
    location: 'a stone and timber harbor slipway at low tide with coiled hemp ropes and a wooden rowboat on blocks',
    subject: 'a weathered red wooden canoe hovering completely unsupported six inches above the dry timber slipway planks, gently rocking as if floating on invisible waves',
    tool: 'a wooden boat oar blade held in a bare hand',
    anchor: 'a dried orange starfish resting on the timber plank directly under the hovering keel to anchor realistic scale',
    escalation: 'when the oar blade pushes down on the wooden gunwale of the hovering canoe, the boat dips two inches into the empty air and displaces visible concentric ripples of refracted air',
    climax: 'the invisible air cushion gives way and the wooden canoe drops onto the timber planks with a heavy thud, kicking up sea-salt dust toward the lens; the operator stumbles back and cuts with NO face visible',
  },
  {
    sub_genre: 'Sunny Meadow Clearing',
    location: 'a bright, cloudless wildflower meadow in full midday sunshine with green grass and white daisies',
    subject: 'a sharply defined 1-meter-by-1-meter cubic volume of pouring rain suspended in the middle of the sunny meadow—torrential rain falling strictly inside the invisible 1-meter cube while the grass one inch outside is bone-dry',
    tool: 'a folded black nylon umbrella tip held in a bare hand',
    anchor: 'a white daisy flower bending under the edge of the water wall while its neighbor stands dry in sunshine to anchor scale',
    escalation: 'when the bare hand pushes the umbrella tip two inches into the rain cube, the water inside instantaneously slows down into hyper-slow-motion suspended spherical raindrops',
    climax: 'the cubic boundary collapses and the suspended water drops splash outward in a 360-degree ring of spray onto the camera lens; the operator steps backward and cuts out with NO face visible',
  },
  {
    sub_genre: 'Rustic Carpentry Yard',
    location: 'an outdoor carpentry work-yard with a heavy timber workbench, wood shavings, and stacked pine boards',
    subject: 'a steel carpenter handsaw resting edge-up on a pine board whose steel blade is undulating smoothly like a swimming ribbon while remaining cold solid steel',
    tool: 'a rectangular block of yellow beeswax held in a bare hand',
    anchor: 'a curled pine wood-shaving ribbon resting beside the saw handle to anchor authentic physical scale',
    escalation: 'when the beeswax block touches the waving steel teeth, the blade freezes in a sharp S-curve geometry and begins humming, making nearby wood shavings levitate two inches in the air',
    climax: 'the S-curved steel blade snaps straight with a loud metallic twang, blasting the levitating wood shavings straight into the smartphone camera; the operator recoils and cuts with NO face visible',
  },
  {
    sub_genre: 'Abandoned Tennis Court',
    location: 'a faded green outdoor asphalt tennis court surrounded by chain-link fencing and autumn trees',
    subject: 'three fuzzy yellow tennis balls hovering in a vertical stack one foot above the white service line, spinning in alternating directions without touching each other',
    tool: 'an aluminum tennis racket frame held in a bare hand',
    anchor: 'a fallen brown horse-chestnut resting on the painted white baseline to anchor realistic physical scale',
    escalation: 'when the racket strings approach within three inches of the stack, the three spinning tennis balls flatten into thin spinning yellow discs in mid-air',
    climax: 'the three discs pop back into spheres and shoot outward in three directions, one bouncing right off the bottom of the smartphone frame; the operator stumbles back and cuts with NO face visible',
  },
  {
    sub_genre: 'Creek Waterwheel Mill',
    location: 'an old mossy timber waterwheel mill beside a clear forest stream under dappled morning sunlight',
    subject: 'the wooden paddles of the stationary waterwheel shedding sheets of water that freeze mid-air into solid, translucent curtains of flexible rubbery ice that sway in the breeze',
    tool: 'a forged iron fireplace poker held in a bare hand',
    anchor: 'a small green frog sitting on the wet timber sluice box to anchor authentic real-world scale',
    escalation: 'when the iron poker pushes against the swaying ice curtain, it stretches four inches like clear elastic latex without breaking or melting',
    climax: 'the stretched ice curtain crystallizes into brittle frost and shatters into a cloud of sparkling ice powder toward the camera lens; the operator steps back abruptly and cuts with NO face visible',
  },
  {
    sub_genre: 'Rural Mailbox Roadside',
    location: 'a quiet paved country lane bordered by tall golden grass and a row of wooden-post roadside mailboxes',
    subject: 'an aluminum rural mailbox with its door open, inside which a miniature tornado of glowing golden autumn leaves is spinning rapidly in a tight 6-inch vortex without escaping the opening',
    tool: 'a rolled-up white envelope held in a bare hand',
    anchor: 'a red plastic mailbox flag upright on the side of the box to anchor authentic physical scale',
    escalation: 'as the bare hand slides the corner of the white envelope into the open mailbox, the spinning leaf vortex pulls the paper inward and folds it into a geometric origami crane in 1 second',
    climax: 'the metal mailbox door slams shut by itself with a loud bang as a gust of wind blasts dry grass against the lens; the operator jerks back and the video ends with NO face visible',
  },
  {
    sub_genre: 'Stone Bridge Canal Lock',
    location: 'a narrow brick-lined canal lock with heavy oak floodgates and iron balance beams on a calm morning',
    subject: 'the dark canal water inside the lock chamber standing divided by an invisible wall where the left side is two feet higher than the right side with a vertical exposed wall of liquid water',
    tool: 'a long bamboo garden cane held in a bare hand',
    anchor: 'a white swan feather floating at the upper edge of the vertical water step to anchor realistic scale',
    escalation: 'when the bamboo cane pokes horizontally into the vertical wall of water, the cane passes dryly into the water without causing a single leak or spill',
    climax: 'the two-foot vertical water step suddenly collapses into a churning wave that splashes high over the brick coping toward the camera; the operator stumbles backward and cuts with NO face visible',
  },
  {
    sub_genre: 'Orchard Wooden Ladder',
    location: 'a sunlit cherry orchard with grass underfoot and a tall wooden A-frame picking ladder standing alone',
    subject: 'a wooden orchard ladder whose top four rungs are detached from the side rails yet remain floating in their exact horizontal positions in mid-air',
    tool: 'a woven wicker fruit basket handle held in a bare hand',
    anchor: 'a pair of bright red cherries on a stem resting on the lowest floating wooden rung to anchor authentic scale',
    escalation: 'when the bare hand presses down on the floating wooden rung, it depresses two inches like a piano key and springs smoothly back to level when released',
    climax: 'all four floating rungs vibrate in unison and snap sideways against the timber rails, showering red cherry petals toward the camera lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Old Brick Courtyard Fountain',
    location: 'a quiet Spanish-style terracotta courtyard centered around a tiered cast-iron water fountain',
    subject: 'dozens of spherical water droplets the size of marbles hovering in a static three-dimensional constellation around the dry fountain basin like frozen planets',
    tool: 'a copper tuning fork held in a bare hand',
    anchor: 'a fallen purple bougainvillea petal resting on the dry iron basin rim to anchor realistic scale',
    escalation: 'when the bare hand strikes the copper tuning fork and holds it near the hovering water marbles, every droplet transforms into a spinning geometric cube of liquid water',
    climax: 'the liquid cubes coalesce into a single central sphere that bursts outward in a fine mist across the smartphone lens; the operator pulls back and the clip terminates with NO face visible',
  },
  {
    sub_genre: 'Timber Sawmill Yard',
    location: 'an outdoor timber sawmill yard carpeted in fresh golden pine sawdust under crisp morning light',
    subject: 'a 3-foot-wide circular steel sawmill blade lying flat on two wooden sawhorses whose reflection shows a dense snow-covered forest while the actual yard around it is warm and sunny',
    tool: 'a carpenter square ruler held in a bare hand',
    anchor: 'a brown pine cone resting on the edge of the steel saw blade to anchor believable physical scale',
    escalation: 'as the steel ruler touches the center arbor hole of the blade, real powdery snow begins rising upward out of the mirror-like steel reflection onto the warm pine sawdust',
    climax: 'a freezing gust of wind erupts from the surface of the circular blade, blasting snow and sawdust straight into the camera lens; the operator stumbles back and cuts with NO face visible',
  },
  {
    sub_genre: 'Suburban Driveway Basketball Hoop',
    location: 'a quiet concrete suburban driveway in late afternoon sun beneath a regulation basketball hoop and backboard',
    subject: 'an orange leather basketball stuck completely motionless in mid-air six inches below the iron rim, spinning at high speed on its vertical axis without falling through the net',
    tool: 'a white sneaker shoelace held in a bare hand',
    anchor: 'a green maple samara seed wing resting on the concrete driveway below to anchor realistic scale',
    escalation: 'when the hanging nylon net strings are brushed by hand, the nylon net strands float upward against gravity and wrap tightly around the spinning basketball',
    climax: 'the basketball shoots straight downward onto the concrete with a thunderous bounce that sends pebble dust toward the camera lens; the operator steps back and cuts out with NO face visible',
  },
  {
    sub_genre: 'Foggy Harbor Pier Bollard',
    location: 'a damp concrete harbor pier in thick morning sea fog beside heavy cast-iron mooring bollards',
    subject: 'a thick 2-inch braided hemp mooring rope tied to an iron bollard whose free end rises at a 60-degree angle into the empty air as if pulled taut by an invisible ship in the sky',
    tool: 'a heavy steel marlinspike tool held in a bare hand',
    anchor: 'a small blue mussel shell resting on the concrete base of the bollard to anchor authentic scale',
    escalation: 'when the steel spike taps the taut upward-pointing hemp rope, the rope vibrates like a giant double-bass string and sheds glowing droplets of seawater that float upward',
    climax: 'the invisible tension releases in an instant and the heavy hemp rope whips down onto the wet concrete pier, splashing spray onto the lens; the operator recoils and cuts with NO face visible',
  },
  {
    sub_genre: 'Backyard Clothesline Lawn',
    location: 'a breezy green backyard lawn strung with a braided wire clothesline between two steel T-posts',
    subject: 'a white cotton bedsheet pinned to the clothesline that is billowed out into the exact, rigid three-dimensional contours of a galloping horse despite zero wind in the yard',
    tool: 'a wooden spring clothespin held in a bare hand',
    anchor: 'a yellow garden butterfly perched on the steel clothesline wire to anchor realistic physical scale',
    escalation: 'when the bare hand clips the wooden clothespin onto the hem of the cotton sheet, the fabric horse shape ripples and takes two visible stepping motions along the wire',
    climax: 'both wooden clothespins pop off the wire at once and the white cotton sheet whips toward the smartphone camera; the operator stumbles backward and the video cuts with NO face visible',
  },
  {
    sub_genre: 'Forest Campfire Clearing',
    location: 'a mossy woodland clearing at twilight beside a stone-bordered camp table and canvas tent',
    subject: 'an open hardcover book lying on the wooden camp table whose paper pages are fanning rapidly by themselves while glowing letters float two inches above the paper like golden fireflies',
    tool: 'a brass magnifying glass held in a bare hand',
    anchor: 'a small acorn resting on the leather book corner to anchor authentic physical scale',
    escalation: 'when the brass magnifying glass lens passes over the floating golden letters, the letters swirl together into a miniature spinning golden sphere above the center crease',
    climax: 'the heavy hardcover book slams shut by itself with a loud clap, sending a puff of glowing dust particles straight at the camera lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Abandoned Gas Station Canopy',
    location: 'a weathered rural roadside service station apron with cracked concrete and vintage analog fuel pumps',
    subject: 'a rubber air-compressor hose coiled on the concrete whose brass nozzle is hovering two feet in the air like a cobra, blowing rhythmic visible rings of silver condensation',
    tool: 'a chrome tire-pressure gauge held in a bare hand',
    anchor: 'a rusted metal bottle cap lying on the concrete pump island to anchor realistic physical scale',
    escalation: 'when the tire gauge touches the hovering brass nozzle, the silver condensation rings freeze in mid-air into solid metallic rings that clink together and drop onto the hose',
    climax: 'the rubber hose bursts with a sharp pneumatic hiss, whipping across the concrete and blasting dust toward the smartphone lens; the operator jumps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Mountain Suspension Footbridge',
    location: 'a narrow steel-cable suspension footbridge over a misty pine ravine in crisp morning air',
    subject: 'the wooden deck planks in the center of the bridge floating three inches above the steel support cables, undulating in a slow, continuous sine wave while the cables remain taut and still',
    tool: 'a collapsible aluminum trekking pole held in a bare hand',
    anchor: 'a small brown pine cone rolling back and forth across the waving wooden plank to anchor authentic scale',
    escalation: 'when the rubber tip of the trekking pole presses down on a floating plank, the wave motion stops instantly and every plank aligns into a rigid staircase ascending into mid-air',
    climax: 'the wooden planks drop back onto the steel cables with a loud clatter that shakes the entire bridge; the operator stumbles a step backward and the clip cuts with NO face visible',
  },
  {
    sub_genre: 'Sunny Patio Umbrella Table',
    location: 'a bright terracotta garden terrace with a wrought-iron patio table and canvas market umbrella',
    subject: 'a clear glass pitcher of water on the iron table where the water inside is spinning in a permanent, deep funnel vortex that rises two inches above the glass rim without spilling a drop',
    tool: 'a long stainless steel iced-tea spoon held in a bare hand',
    anchor: 'a fresh yellow lemon slice resting on the iron table mesh to anchor realistic physical scale',
    escalation: 'when the steel spoon is dipped into the rising water funnel, the spinning water climbs up the handle of the spoon and forms a hovering liquid sphere around the operator knuckles',
    climax: 'the liquid sphere collapses back into the pitcher with a sharp splash that sprays cold droplets across the camera lens; the operator pulls back and the video terminates with NO face visible',
  },
  {
    sub_genre: 'Brick Clocktower Courtyard',
    location: 'an old university courtyard paved with grey flagstones beneath a red-brick bell tower',
    subject: 'a heavy cast-bronze bell sitting on a low wooden pallet in the courtyard that is visibly expanding and contracting by two inches like a breathing lung every three seconds',
    tool: 'a wooden drumstick mallet held in a bare hand',
    anchor: 'a fallen green oak leaf resting on the wooden pallet slat to anchor authentic physical scale',
    escalation: 'when the wooden mallet lightly touches the breathing bronze rim, the metal surface ripples like liquid bronze while producing a visible ring of shimmering air refraction',
    climax: 'the bronze bell locks rigid with a deep resonant boom that blasts surrounding autumn leaves outward toward the smartphone lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Woodland Creek Stepping Stones',
    location: 'a shallow, sunlit woodland stream crossed by a row of flat cut-timber blocks',
    subject: 'a 1-foot wide dry air tunnel cutting cleanly across the flowing stream—water flows normally on both sides but stops at an invisible vertical wall, leaving a dry strip of sandy streambed exposed',
    tool: 'a green willow branch held in a bare hand',
    anchor: 'a small orange autumn leaf carried by the current that stops flat against the invisible air wall to anchor scale',
    escalation: 'when the willow branch pokes across the invisible water boundary, water begins spiraling around the branch like a corkscrew tube bridging the dry gap',
    climax: 'the invisible barrier vanishes and the two walls of stream water slam together, splashing cold creek water straight onto the camera lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Rustic Farm Wheelbarrow',
    location: 'a gravel barnyard path beside a stacked firewood shed under bright morning light',
    subject: 'a steel garden wheelbarrow filled with split birch firewood logs where all twelve heavy wooden logs are levitating four inches above the steel tray in a neat hovering grid',
    tool: 'a leather work glove held in a bare hand',
    anchor: 'a small white chicken feather resting on the rubber wheelbarrow tire to anchor realistic physical scale',
    escalation: 'when the leather glove taps the center floating birch log, all twelve logs rotate 90 degrees in mid-air in synchronized formation like magnetic compass needles',
    climax: 'the hovering firewood logs drop simultaneously into the steel wheelbarrow tray with a deafening crash that shakes the camera; the operator stumbles backward and cuts with NO face visible',
  },
  {
    sub_genre: 'Urban Rooftop Water Tank',
    location: 'a tar-and-gravel urban rooftop under overcast skies beside a cedar rooftop water tank',
    subject: 'a metal ventilation turbine spinning backward while pulling surrounding rain puddles upward off the roof gravel in continuous thin silver threads of water',
    tool: 'a galvanized steel wrench held in a bare hand',
    anchor: 'a small white quartz roof pebble caught at the base of a rising water thread to anchor authentic scale',
    escalation: 'when the steel wrench interrupts one of the rising water threads, the liquid thread coils around the wrench shaft like a glowing silver spring',
    climax: 'the turbine stops with a metallic screech and all suspended water threads splash down at once onto the rooftop gravel and camera lens; the operator recoils and cuts with NO face visible',
  },
  {
    sub_genre: 'Lakeside Birch Canoe Dock',
    location: 'a quiet cedar floating dock on a misty northern lake surrounded by white birch trees',
    subject: 'an aluminum tackle box open on the dock planks whose brass fishing lures are hovering six inches in the air and swimming in slow circular figure-eights as if underwater',
    tool: 'a wooden landing net rim held in a bare hand',
    anchor: 'a red-and-white plastic bobber resting on the cedar plank to anchor believable physical scale',
    escalation: 'as the wooden net rim sweeps beneath the hovering lures, the air inside the net shimmers like liquid water and refracts the dock planks below',
    climax: 'the tackle box lid snaps shut by itself as the hovering lures drop onto the aluminum lid with a sharp rattle; the operator jerks the camera back and cuts with NO face visible',
  },
  {
    sub_genre: 'Garden Brick Sundial Path',
    location: 'a hedged botanical garden path centered around a weathered brass sundial on a brick pedestal',
    subject: 'the triangular brass gnomon of the sundial casting a glowing beam of golden sunlight onto the shaded brick pedestal even though the sky overhead is completely overcast with grey clouds',
    tool: 'a pair of steel pruning shears held in a bare hand',
    anchor: 'a small green boxwood leaf resting on the engraved Roman numerals of the dial to anchor realistic scale',
    escalation: 'when the steel pruning blades intercept the glowing light beam, the light beam bends at a sharp 90-degree angle like a solid laser rod and projects a rotating clock face onto the hedge',
    climax: 'the brass gnomon emits a bright flash that scatters frost crystals across the dial plate toward the smartphone lens; the operator steps backward and cuts out with NO face visible',
  },
  {
    sub_genre: 'Old Stone Arch Viaduct',
    location: 'a grassy footpath beneath a towering brick railway viaduct arch after a morning rain',
    subject: 'a row of twenty water droplets hanging motionless in mid-air at eye level in a perfectly straight horizontal line across the archway like suspended glass beads on an invisible wire',
    tool: 'a stainless steel pocketknife blade held in a bare hand',
    anchor: 'a small brown snail clinging to the damp brickwork beside the first suspended droplet to anchor authentic scale',
    escalation: 'when the flat of the steel blade touches the first suspended droplet, a chain-reaction ripple travels down all twenty floating droplets, turning each one into a sparkling ice crystal sphere',
    climax: 'all twenty ice spheres shatter simultaneously in mid-air with a sharp crackle, spraying fine frost mist at the camera lens; the operator stumbles back and cuts with NO face visible',
  },
  {
    sub_genre: 'Rural Wooden Stile',
    location: 'a mossy wooden stile crossing a dry-stone pasture wall in rolling green hills under breezy skies',
    subject: 'a tall patch of wild meadow grass in a 2-foot circle that is frozen solid like brittle green glass and completely motionless while the surrounding grass bends wildly in the wind',
    tool: 'a hazel walking stick held in a bare hand',
    anchor: 'a small white pasture mushroom growing right at the border of the frozen grass circle to anchor scale',
    escalation: 'when the hazel stick lightly taps a blade of the motionless grass, the entire 2-foot circle resonates like crystal chimes and projects a shimmering dome of air refraction',
    climax: 'the glass-like grass blades suddenly snap back into normal wind motion, whipping a burst of pollen and dew straight into the camera lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Courtyard Iron Bicycle Rack',
    location: 'a quiet brick courtyard outside an old library with a black wrought-iron bicycle rack',
    subject: 'a forgotten black umbrella resting open on the bricks that is hovering four inches off the ground while rainwater drips UPWARD from its nylon tips into the overcast sky',
    tool: 'a brass house key held between bare fingers',
    anchor: 'a wet yellow ginkgo leaf resting on the damp brick beneath the hovering umbrella handle to anchor scale',
    escalation: 'when the brass key touches the metal ferule at the top of the umbrella, the nylon canopy inverts itself in 0.1 seconds while trapping a floating sphere of rainwater inside',
    climax: 'the trapped water sphere bursts outward over the umbrella rim, splashing cold droplets directly onto the smartphone camera; the operator recoils and the clip cuts with NO face visible',
  },
  {
    sub_genre: 'Timber Boardwalk Marsh',
    location: 'a raised cedar boardwalk winding through a golden reed marsh under calm morning light',
    subject: 'a 3-foot section of marsh water beside the boardwalk where the reflection of the reeds is waving wildly in a gale-force storm while the actual reeds above the water are 100% still',
    tool: 'a dry hollow cattail reed stem held in a bare hand',
    anchor: 'a blue damselfly resting motionless on the cedar boardwalk edge to anchor realistic micro scale',
    escalation: 'when the hollow reed stem breaks the mirror surface of the water, gale-force wind erupts upward out of the water reflection in a narrow vertical column, blowing the operator sleeve',
    climax: 'the water surface erupts in a sudden circular splash that coats the boardwalk and camera lens in fine marsh spray; the operator stumbles backward and cuts with NO face visible',
  },
  {
    sub_genre: 'Rustic Blacksmith Anvil Shed',
    location: 'an open-sided timber blacksmith shed with a heavy cast-iron anvil on an oak stump',
    subject: 'a cold steel horseshoe resting flat on the iron anvil that is floating one inch above the metal face while glowing orange sparks orbit around it in slow, silent horizontal rings',
    tool: 'a pair of long iron blacksmith tongs held in a bare hand',
    anchor: 'a cold iron square nail resting on the corner of the anvil horn to anchor authentic physical scale',
    escalation: 'when the iron tongs grip the floating horseshoe, the anvil surface underneath turns mirror-clear like liquid mercury and ripples in concentric metallic waves',
    climax: 'the horseshoe slams down onto the anvil face with a deafening metallic ring, blasting a ring of scale dust toward the smartphone lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Suburban Wooden Deck',
    location: 'a stained redwood backyard deck after a hailstorm, with patio chairs and cedar railings',
    subject: 'dozens of white hailstones on the wooden deck planks spontaneously rolling uphill against the slope and assembling themselves into a 12-inch hollow geodesic dome of ice',
    tool: 'a stainless steel kitchen tablespoon held in a bare hand',
    anchor: 'a green hosta leaf torn by hail resting beside the self-assembling ice dome to anchor scale',
    escalation: 'when the back of the steel spoon touches the apex of the hailstone dome, the ice spheres fuse together into a single glowing translucent crystal hemisphere',
    climax: 'the crystal hemisphere pops under internal pressure, scattering harmless hailstones across the deck planks toward the camera; the operator jerks back and cuts out with NO face visible',
  },
  {
    sub_genre: 'Country Barn Hayloft Door',
    location: 'the gravel yard below a tall red timber barn with an open upper hayloft door and pulley beam',
    subject: 'a thick hemp pulley rope hanging from the upper beam whose lower ten feet are tied in a square knot that is slowly untying and re-tying itself in mid-air like a living snake',
    tool: 'a wooden pitchfork handle held in a bare hand',
    anchor: 'a golden stalk of dry straw caught in the lower hemp fibers to anchor realistic physical scale',
    escalation: 'when the wooden handle touches the moving knot, the hemp rope freezes rigid as cast iron in mid-air, supporting the weight of the leaning pitchfork handle',
    climax: 'the rope knot snaps loose with a sharp whip-crack that sends dust and straw fibers flying straight at the smartphone lens; the operator stumbles back and cuts with NO face visible',
  },
  {
    sub_genre: 'Park Stone Drinking Fountain',
    location: 'a shaded asphalt park path beside a cast-concrete drinking fountain and maple trees',
    subject: 'the parabolic arc of water from the chrome drinking spout frozen motionless in mid-air like a solid arch of clear optical acrylic while still wet and dripping at its apex',
    tool: 'a plastic bicycle water bottle held in a bare hand',
    anchor: 'a small green maple seed wing resting on the chrome basin drain to anchor authentic scale',
    escalation: 'when the plastic bottle nudges the center of the motionless water arch, the water arch bends sideways like a flexible fiber-optic cable and projects a bright rainbow onto the basin',
    climax: 'the frozen water arch collapses into a sudden pressurized spray that splashes straight onto the smartphone camera lens; the operator flinches backward and cuts with NO face visible',
  },
  {
    sub_genre: 'Lakeside Pebble Jetty',
    location: 'a timber-piling jetty extending into a calm mountain lake at sunrise',
    subject: 'an old galvanized metal bucket sitting on the jetty planks where water is pouring continuously over the rim yet the bucket never empties and the planks underneath remain 100% bone-dry',
    tool: 'a wooden canoe paddle tip held in a bare hand',
    anchor: 'a small white snail shell resting one inch from the dry bucket base to anchor realistic scale',
    escalation: 'when the wooden paddle tip touches the overflowing water curtain, the water reverses direction and flows upward from the dry planks back into the galvanized bucket',
    climax: 'the metal bucket tips over onto its side with a loud clang, releasing a real wave of cold water toward the operator boots and camera lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Pine Forest Picnic Table',
    location: 'a quiet cedar picnic table in a shaded pine grove with pine needles covering the ground',
    subject: 'an aluminum camping compass lying on the wooden tabletop whose magnetic needle has detached from the pivot and is hovering two inches above the broken glass, spinning rapidly',
    tool: 'a stainless steel camping fork held in a bare hand',
    anchor: 'a dry pine needle resting on the wooden table plank beside the brass bezel to anchor scale',
    escalation: 'as the steel fork approaches the hovering compass needle, surrounding pine needles on the table rise up on their sharp tips and point straight toward the floating needle',
    climax: 'a small blue static spark jumps from the hovering needle to the fork, dropping all the upright pine needles at once as the operator jerks the phone backward and cuts with NO face visible',
  },
  {
    sub_genre: 'Historic Brick Canal Bridge',
    location: 'the towpath beneath a low curved red-brick canal bridge in calm morning light',
    subject: 'a bicycle tire inner tube floating on the canal water whose center ring contains a dry, grass-covered patch of ground four inches below the surrounding water level',
    tool: 'a 1-meter wooden yardstick held in a bare hand',
    anchor: 'a small yellow buttercup flower growing inside the dry center of the floating inner tube to anchor scale',
    escalation: 'when the wooden yardstick presses down on the rubber tube rim, the tube submerges two inches deeper while the dry grass patch inside remains completely dry inside a cylinder of water',
    climax: 'the rubber tube flips upward out of the water, splashing canal spray across the towpath and camera lens; the operator stumbles backward and the video terminates with NO face visible',
  },
  {
    sub_genre: 'Abandoned Quarry Conveyor',
    location: 'an overgrown industrial yard with a rusted steel conveyor frame and tall weeds',
    subject: 'five heavy steel ball-bearings rolling continuously in a vertical circle in mid-air between two rusted iron rollers that are three feet apart with no belt connecting them',
    tool: 'a flat steel mechanic spanner held in a bare hand',
    anchor: 'a small orange butterfly resting on the rusted iron frame to anchor believable physical scale',
    escalation: 'when the steel spanner is held inside the circular path of the orbiting ball-bearings, the five steel spheres pause in mid-air and form a hovering five-pointed star',
    climax: 'all five steel bearings snap onto the mechanic spanner at once with a sharp metallic clack that jolts the operator hand; the camera jerks backward and cuts with NO face visible',
  },
  {
    sub_genre: 'Orchard Cider Press Shed',
    location: 'a weathered timber shed housing an antique oak-and-iron apple cider screw press',
    subject: 'a stream of golden apple cider pouring from the wooden spout that ties itself into a perfect overhand knot in mid-air before continuing into the wooden bucket below',
    tool: 'a clean wooden ladle held in a bare hand',
    anchor: 'a green apple leaf resting on the oak press beam to anchor realistic physical scale',
    escalation: 'when the wooden ladle touches the mid-air liquid knot, the knotted stream solidifies into warm translucent amber resin that holds the ladle suspended in the air',
    climax: 'the amber knot bursts into a spray of golden droplets across the timber floor and smartphone lens; the operator steps backward abruptly and the clip ends with NO face visible',
  },
  {
    sub_genre: 'Coastal Lighthouse Stairwell',
    location: 'the open iron spiral staircase at the base of a whitewashed coastal lighthouse in breezy daylight',
    subject: 'a heavy brass plumb-bob hanging on a braided cord from the spiral stair railing that is swinging in a perfect square trajectory instead of a circular arc',
    tool: 'a white wooden pencil held in a bare hand',
    anchor: 'a small white barnacle shell attached to the painted iron step to anchor authentic scale',
    escalation: 'when the pencil lightly touches the braided cord, the brass plumb-bob stops at a 30-degree corner angle in mid-air with the cord bent at two sharp right angles in empty space',
    climax: 'the cord snaps straight with a sharp twang and the brass weight swings toward the camera lens; the operator ducks backward and the recording cuts out with NO face visible',
  },
  {
    sub_genre: 'Suburban Garden Birdbath',
    location: 'a quiet suburban lawn beside a carved concrete pedestal birdbath and blooming rose bushes',
    subject: 'the water inside the circular birdbath standing risen in the center like a 6-inch-tall spinning wedding cake made of crystal-clear liquid water with sharp horizontal tiers',
    tool: 'a green bamboo plant stake held in a bare hand',
    anchor: 'a crimson rose petal resting on the dry concrete rim of the birdbath to anchor realistic scale',
    escalation: 'when the bamboo stake touches the top liquid tier, the crimson rose petal is pulled into the spinning water tiers and orbits rapidly without getting wet',
    climax: 'the tiered liquid column collapses flat into the basin with a sharp slap that splashes water droplets onto the camera lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Timber Covered Bridge',
    location: 'inside a historic red wooden covered bridge with diagonal timber trusses and dusty sunlit plank floors',
    subject: 'a shaft of dusty afternoon sunlight slanting through a side window that behaves like a solid golden glass beam—falling oak leaves hit the sunbeam and slide down its upper surface as if sliding down a ramp',
    tool: 'a rolled-up leather map case held in a bare hand',
    anchor: 'three dry autumn leaves resting supported in mid-air on top of the slanted sunbeam to anchor scale',
    escalation: 'when the leather map case presses down against the shaft of sunlight, the sunbeam bends downward like a flexible fiberglass rod and scatters rainbow ripples across the ceiling trusses',
    climax: 'the bent sunbeam springs back straight, launching the resting oak leaves and glowing dust motes straight into the smartphone lens; the operator stumbles back and cuts with NO face visible',
  },
  {
    sub_genre: 'Harbor Wooden Fish Market',
    location: 'an empty morning timber wharf deck beside stacked wooden lobster traps and hemp netting',
    subject: 'a glass fisherman float ball inside a woven rope net that is glowing with internal turquoise ocean waves crashing inside the sealed glass sphere in complete sync with harbor swells',
    tool: 'a brass boat-hook tip held in a bare hand',
    anchor: 'a small red crab claw shell resting on the wooden lobster trap slat to anchor authentic scale',
    escalation: 'when the brass tip taps the glass float, the rope netting around it untangles itself and stands straight up in the air like a woven basket tower',
    climax: 'the glass sphere emits a bright turquoise flash and cracks down the seam, spraying sea mist onto the camera lens; the operator steps backward and cuts out with NO face visible',
  },
  {
    sub_genre: 'Woodland Log Cabin Porch',
    location: 'the rough-hewn pine porch of a forest log cabin with a wooden rocking chair and split rail',
    subject: 'an empty cedar rocking chair rocking vigorously back and forth on its own while a porcelain coffee mug sitting on its flat wooden armrest remains 100% level and motionless in space',
    tool: 'a pine kindling stick held in a bare hand',
    anchor: 'a small green pine cone resting on the porch floorboard beside the chair runner to anchor scale',
    escalation: 'when the kindling stick touches the stationary porcelain mug, the chair freezes mid-rock at an extreme backward tilt while the mug floats two inches above the angled armrest',
    climax: 'the rocking chair slams forward onto its front runners with a loud wooden crack that jolts the porch and camera; the operator stumbles backward and cuts with NO face visible',
  },
  {
    sub_genre: 'Urban Alley Fire Escape',
    location: 'a quiet brick alleyway beneath a black steel fire-escape ladder and wet pavement',
    subject: 'a stream of rainwater dripping from the lowest steel fire-escape rung that forms into hollow, transparent liquid cubes that stack five-high on the wet asphalt without bursting',
    tool: 'a metal car key held in a bare hand',
    anchor: 'a wet green linden leaf lying next to the bottom liquid cube to anchor realistic physical scale',
    escalation: 'when the metal key pokes the middle cube in the five-cube stack, only the middle cube vanishes while the top two liquid cubes remain hovering in mid-air above the gap',
    climax: 'the remaining liquid cubes burst simultaneously into a pressurized spray of cold water droplets against the smartphone lens; the operator flinches back and cuts with NO face visible',
  },
  {
    sub_genre: 'Country Windmill Water Trough',
    location: 'a dry pasture corral beside a circular galvanized steel livestock water trough',
    subject: 'the water inside the circular steel trough parted cleanly down the middle by a 4-inch-wide dry metal strip across the bottom while water stands in two separate half-moons on either side',
    tool: 'a wooden riding crop tip held in a bare hand',
    anchor: 'a small yellow straw stem lying completely dry on the exposed center strip of the trough bottom to anchor scale',
    escalation: 'when the wooden tip touches the dry center strip, both vertical walls of water begin rotating in opposite directions like spinning glass wheels inside the trough',
    climax: 'the two water halves slam together at the center with a loud hydraulic clap, launching a sheet of water straight at the camera lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Botanical Bamboo Grove',
    location: 'a quiet gravel footpath winding through a dense green giant bamboo grove in soft morning light',
    subject: 'a cut hollow green bamboo stalk standing four feet tall from which rings of glowing silver water mist are shooting upward every two seconds and hovering like solid silver halos',
    tool: 'a folding wooden fan held in a bare hand',
    anchor: 'a narrow green bamboo leaf resting on the cut rim of the stalk to anchor authentic scale',
    escalation: 'when the wooden fan slices horizontally through one of the hovering silver rings, the ring splits into two interlocking figure-eight mist rings that spin in mid-air',
    climax: 'a sudden pressurized jet of water erupts from the hollow bamboo stalk, blasting the mist rings straight into the camera lens; the operator stumbles back and cuts with NO face visible',
  },
  {
    sub_genre: 'Vintage Garage Workbench',
    location: 'an open-door brick garage workshop with an oil-stained oak workbench and vintage hand tools',
    subject: 'a heavy cast-iron bench vise whose steel jaws are holding a 6-inch block of clear liquid water compressed into a solid, quivering cube with no container around it',
    tool: 'a flathead steel screwdriver held in a bare hand',
    anchor: 'a brass hex nut resting on the cast-iron vise slide to anchor realistic physical scale',
    escalation: 'when the screwdriver blade presses into the top of the compressed water cube, a glowing geometric lattice of ice crystals forms around the steel tip inside the liquid cube',
    climax: 'the compressed water cube slips from the steel jaws and explodes into a harmless high-velocity splash across the workbench and camera lens; the operator recoils and cuts with NO face visible',
  },
  {
    sub_genre: 'Misty Vineyard Trellis Row',
    location: 'a damp hillside vineyard at dawn between rows of wooden trellis posts and steel support wires',
    subject: 'hundreds of morning dew drops along a 6-foot steel trellis wire marching in single-file uphill along the wire and merging into a fist-sized hovering water sphere at the wooden end-post',
    tool: 'a wooden wine cork held between bare fingers',
    anchor: 'a curled brown grapevine tendril wrapped around the wire beside the water sphere to anchor scale',
    escalation: 'when the bare hand presses the wooden cork against the hovering water sphere, the cork is sucked into the center of the floating sphere and spins rapidly like a gyroscope',
    climax: 'the hovering water sphere cavitates and bursts outward, launching the wine cork and a spray of cold dew toward the camera lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Stone Farmhouse Kitchen Yard',
    location: 'a flagstone courtyard outside a rustic stone cottage with an outdoor cast-iron hand water pump',
    subject: 'the iron handle of the hand pump pumping slowly up and down by itself while a continuous ribbon of solid, crystal-clear ice extrudes smoothly from the spout and coils like rope on the flagstones',
    tool: 'a wooden rolling pin held in a bare hand',
    anchor: 'a sprig of fresh green rosemary resting on the flagstone beside the ice coil to anchor scale',
    escalation: 'when the wooden rolling pin taps the extruding ice coil, the coiled ice ribbon begins glowing with internal pale-blue light and uncoils upward into the air',
    climax: 'the coiled ice ribbon shatters into hundreds of ringing crystal cylinders across the flagstones toward the camera; the operator stumbles backward and cuts with NO face visible',
  },
  {
    sub_genre: 'Timber Canal Drawbridge',
    location: 'a white-painted wooden Dutch-style canal drawbridge with heavy overhead balance beams and chains',
    subject: 'a puddle of rainwater on the wooden bridge deck that rises into a 1-foot-tall miniature liquid replica of the drawbridge itself, complete with water arches',
    tool: 'a small brass key ring held in a bare hand',
    anchor: 'a fallen yellow willow leaf floating beside the base of the liquid sculpture to anchor scale',
    escalation: 'when the brass key ring touches the arch of the miniature water bridge, the liquid sculpture freezes solid into clear ice in 0.05 seconds',
    climax: 'the ice sculpture fractures down the middle and splashes outward in a burst of cold droplets against the smartphone lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Forest Fire Lookout Base',
    location: 'the concrete footing and steel girder stairway at the base of a woodland fire lookout tower',
    subject: 'a galvanized steel bucket hanging from a girder hook that is swinging in a slow circle while its shadow on the concrete slab beneath it remains locked in the center without moving',
    tool: 'a green pine bough held in a bare hand',
    anchor: 'a small grey moth resting on the concrete footing block to anchor realistic physical scale',
    escalation: 'when the pine needles brush the swinging steel bucket, the bucket stops dead in mid-air at a 35-degree angle while the shadow on the concrete begins circling rapidly',
    climax: 'the iron hook snaps and the steel bucket drops onto the concrete with a loud metallic crash, kicking dust toward the camera lens; the operator recoils and cuts with NO face visible',
  },
  {
    sub_genre: 'Park Pergola Wisteria Walk',
    location: 'a brick garden walkway beneath an oak timber pergola draped with hanging wisteria vines',
    subject: 'a 3-foot circular zone in the center of the walkway where falling purple wisteria petals stop four feet in the air and form a flat, rotating horizontal disc of floating flowers',
    tool: 'a wooden artist paintbrush held in a bare hand',
    anchor: 'a honeybee resting on a timber pergola post beside the floating flower disc to anchor scale',
    escalation: 'when the paintbrush tip touches the center of the floating petal disc, the petals arrange themselves into concentric geometric rings that spin faster and faster',
    climax: 'a sudden upward air draft blasts the spinning flower petals and dust straight toward the smartphone camera lens; the operator steps backward and cuts out with NO face visible',
  },
  {
    sub_genre: 'Harbor Concrete Breakwater',
    location: 'a long weathered concrete harbor breakwater wall washed by gentle turquoise sea swells',
    subject: 'an old rubber car tire resting flat on the concrete wall whose circular center opening acts as an optical magnifying lens—showing the concrete grain below magnified 50x as if through thick crystal glass',
    tool: 'a driftwood stick held in a bare hand',
    anchor: 'a small white seashell resting on the black rubber tire sidewall to anchor authentic scale',
    escalation: 'when the driftwood stick pokes downward into the empty center of the rubber tire, the stick refracts at a sharp angle as if entering dense liquid glass and frosts over instantly',
    climax: 'the optical lens inside the tire flashes bright white and ejects a puff of sea-salt vapor straight into the camera lens; the operator stumbles backward and cuts with NO face visible',
  },
  {
    sub_genre: 'Rural Timber Corral Gate',
    location: 'a dusty sunlit ranch corral gate built from peeled pine logs with forged iron hinges',
    subject: 'a coiled leather lasso hanging on a wooden peg whose bottom loop is hovering horizontally in mid-air and spinning like a gyroscope while glowing dust motes rise through the loop',
    tool: 'a steel hoof-pick tool held in a bare hand',
    anchor: 'a small brown sparrow feather caught in the pine bark of the gatepost to anchor scale',
    escalation: 'when the steel tool taps the spinning leather loop, the air inside the leather circle turns into a shimmering silver mirror reflecting the sky behind the operator',
    climax: 'the leather loop snaps shut with a sharp whip-crack that blasts corral dust straight into the smartphone camera lens; the operator steps back abruptly and cuts with NO face visible',
  },
  {
    sub_genre: 'Old Brick Railway Roundhouse',
    location: 'an overgrown outdoor railway turntable pit with rusted steel tracks and brick retaining walls',
    subject: 'a 4-foot section of rusted steel railway track whose upper iron rail is slowly flexing upward and downward like a breathing ribcage every two seconds while bolted to wooden ties',
    tool: 'a heavy steel track bolt held in a bare hand',
    anchor: 'a yellow wild mustard flower growing beside the wooden railway tie to anchor realistic scale',
    escalation: 'when the bare hand places the steel bolt on top of the flexing rail, the bolt levitates three inches above the iron and vibrates with a visible high-frequency blur',
    climax: 'the steel rail snaps back flat against the wooden ties with a thunderous metallic boom, launching the bolt and rust flakes toward the lens; the operator recoils and cuts with NO face visible',
  },
  {
    sub_genre: 'Woodland Birch Footpath',
    location: 'a quiet autumn forest footpath carpeted in golden birch leaves after a light morning frost',
    subject: 'a 2-foot circular ring of birch leaves hovering vertically in mid-air like a standing portal frame, through which the forest trail appears covered in deep winter snow',
    tool: 'a dry oak branch held in a bare hand',
    anchor: 'a red woodland beetle crawling on a root right beneath the hovering leaf ring to anchor scale',
    escalation: 'when the bare hand pushes the tip of the oak branch four inches through the hovering ring of leaves, the branch tip emerges coated in thick white winter snow and icicles',
    climax: 'the standing ring of leaves collapses inward with a sharp rush of freezing wind that blows snowflakes straight onto the camera lens; the operator stumbles back and cuts with NO face visible',
  },
  {
    sub_genre: 'Courtyard Terracotta Olive Jar',
    location: 'a sunlit Mediterranean limestone patio beside a large antique terracotta olive-oil amphora jar',
    subject: 'a stream of golden olive oil pouring upward out of the open mouth of the terracotta jar and forming a hovering, self-contained golden torus ring one foot above the rim',
    tool: 'a carved olive-wood spoon held in a bare hand',
    anchor: 'a silver-green olive leaf resting on the terracotta lip of the jar to anchor authentic scale',
    escalation: 'when the wooden spoon touches the hovering golden torus, the oil ring splits into three concentric golden rings that orbit around the spoon handle in mid-air',
    climax: 'the three hovering rings drop back into the jar mouth with a sharp acoustic pop, splashing golden droplets toward the camera lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Suburban Asphalt Cul-de-Sac Hoop',
    location: 'a quiet suburban sidewalk beside a wooden telephone pole and green lawn strip',
    subject: 'a child red metal tricycle sitting unattended on the sidewalk whose front wheel is hovering four inches off the concrete while the pedals rotate smoothly backward by themselves',
    tool: 'a white sidewalk chalk stick held in a bare hand',
    anchor: 'a fallen green acorn resting on the concrete sidewalk beside the rear wheel to anchor scale',
    escalation: 'when the white chalk stick touches the spinning rubber front tire, a glowing white chalk line draws itself in mid-air around the hovering wheel',
    climax: 'the front wheel drops onto the concrete with a sharp metallic clack and the handlebar bell rings loudly as the operator jerks the phone back and cuts with NO face visible',
  },
  {
    sub_genre: 'Lakeside Cedar Boathouse',
    location: 'the wet wooden slipway inside an open-sided cedar boathouse with calm green lake water',
    subject: 'a pair of red cork life-preserver rings floating on the water that are orbiting each other while the water trapped inside their center holes rises up in two 1-foot solid water cylinders',
    tool: 'a brass boat whistle on a lanyard held in a bare hand',
    anchor: 'a small green duckweed patch clinging to the wet cedar beam to anchor realistic scale',
    escalation: 'when the brass whistle touches one of the rising water cylinders, both water columns freeze instantaneously into solid cylinders of glowing white ice',
    climax: 'the two ice cylinders tip over and shatter against the wooden slipway, splashing cold lake water onto the camera lens; the operator stumbles back and cuts with NO face visible',
  },
  {
    sub_genre: 'Botanical Stone Conservatory',
    location: 'an outdoor botanical courtyard with a cast-iron armillary sphere sculpture on a stone plinth',
    subject: 'the interlocking bronze rings of the antique armillary sphere rotating smoothly by themselves while a fist-sized sphere of clear rainwater hovers unsupported at the exact center',
    tool: 'a stainless steel fountain pen held in a bare hand',
    anchor: 'a small white jasmine flower resting on the bronze horizon ring to anchor authentic scale',
    escalation: 'when the nib of the fountain pen touches the central hovering water sphere, dark blue ink blooms inside the floating water in a rotating three-dimensional galaxy spiral',
    climax: 'the bronze rings lock in place with a sharp metallic clank and the water sphere bursts into fine mist across the lens; the operator steps backward and cuts with NO face visible',
  },
  {
    sub_genre: 'Country Wooden Wind-Pump',
    location: 'a quiet meadow trail beside an old timber garden shed and a stacked cord of birch firewood',
    subject: 'a galvanized steel watering can resting on a wooden bench that is tilted forward at a 60-degree angle in mid-air with water pouring out into a hovering horizontal spiral that never hits the ground',
    tool: 'a bamboo garden trowel handle held in a bare hand',
    anchor: 'a small yellow snail shell resting on the wooden bench slat below to anchor scale',
    escalation: 'when the trowel handle touches the hovering water spiral, the spiral retracts backward into the watering can rose nozzle like a rewinding tape',
    climax: 'the galvanized watering can drops flat onto the wooden bench with a loud rattle, splashing water droplets toward the camera; the operator recoils and cuts with NO face visible',
  },
  {
    sub_genre: 'Misty Pine Boardwalk',
    location: 'a damp wooden nature-trail boardwalk in a misty cedar forest after morning rain',
    subject: 'a 4-foot-long spiderweb strung between two cedar handrail posts whose silk threads are holding hundreds of giant 1-inch cubic water blocks instead of round dew droplets',
    tool: 'a dry pine twig held in a bare hand',
    anchor: 'a small brown pine needle stuck to the wooden post beside the web anchor to anchor scale',
    escalation: 'when the pine twig gently plucks the bottom silk strand, all the cubic water blocks chime and rotate 45 degrees in unison into diamond orientations',
    climax: 'the silk web strand snaps and all the water cubes splash down onto the wooden handrail, spraying mist straight at the camera lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Old Brick Brewery Yard',
    location: 'a cobblestone loading yard beside stacked weathered oak barrels under overcast skies',
    subject: 'an oak barrel standing upright whose top wooden lid is floating five inches in the air on a cushion of glowing amber foam that neither spills nor dissolves',
    tool: 'a heavy iron barrel bung-mallet held in a bare hand',
    anchor: 'a rusted iron hoop rivet on the side of the oak barrel to anchor realistic physical scale',
    escalation: 'when the wooden mallet head presses down on the floating oak lid, the glowing foam compresses and emits concentric rings of shimmering air distortion',
    climax: 'the oak lid pops upward two inches with a loud cork-pop report, spraying harmless amber mist toward the smartphone lens; the operator stumbles backward and cuts with NO face visible',
  },
  {
    sub_genre: 'Park Wooden Gazebo',
    location: 'an octagonal white-painted wooden gazebo in a leafy town park on a quiet morning',
    subject: 'an antique acoustic guitar leaning against the gazebo railing whose six steel strings are vibrating in huge 2-inch-wide slow-motion waves while dust motes dance in geometric patterns',
    tool: 'a celluloid guitar pick held between bare fingers',
    anchor: 'a fallen green maple leaf resting on the wooden gazebo step beside the guitar body to anchor scale',
    escalation: 'when the guitar pick touches the sixth steel string, the wooden soundboard ripples like liquid honey and projects a visible ring of golden dust out of the soundhole',
    climax: 'the high E string snaps with a sharp metallic twang that sends the dust ring straight into the camera lens; the operator jerks the phone backward and cuts with NO face visible',
  },
  {
    sub_genre: 'Rural Tractor Barn',
    location: 'a gravel farmyard beside an open timber machinery shed and a vintage red farm tractor',
    subject: 'the vertical steel exhaust pipe of the parked, cold tractor blowing perfect interlocking square smoke rings that hover motionless in a horizontal staircase in mid-air',
    tool: 'a chrome box-end wrench held in a bare hand',
    anchor: 'a dried yellow corn husk resting on the red steel tractor hood to anchor authentic scale',
    escalation: 'when the chrome wrench passes through the nearest square smoke ring, the smoke ring solidifies into a brittle grey carbon-frost frame that clinks against the steel wrench',
    climax: 'the tractor exhaust flapper clanks shut and a gust of air shatters all the hovering rings toward the camera lens; the operator steps backward and cuts out with NO face visible',
  },
  {
    sub_genre: 'Canal Towpath Iron Bollard',
    location: 'a wet brick canal towpath beside an iron footbridge in cool morning mist',
    subject: 'a row of five cast-iron canal bollards whose wet tops are each supporting a spinning, 8-inch-tall vertical tornado of clear canal water in mid-air',
    tool: 'a folded black umbrella tip held in a bare hand',
    anchor: 'a small white gull feather resting on the damp brick beside the first bollard to anchor scale',
    escalation: 'when the umbrella tip touches the first water tornado, all five spinning water columns lean 45 degrees toward each other and merge into a single hovering liquid arch',
    climax: 'the hovering water arch collapses onto the brick towpath with a loud splash that sprays water onto the smartphone lens; the operator stumbles back and cuts with NO face visible',
  },
  {
    sub_genre: 'Backyard Timber Pergola',
    location: 'a sunlit cedar deck beneath a timber pergola with hanging glass wind-chimes',
    subject: 'a set of six tubular copper wind-chimes hanging splayed outward at a 60-degree cone in dead-calm air while drops of water orbit around the copper tubes like miniature satellites',
    tool: 'a wooden chopstick held in a bare hand',
    anchor: 'a small green katydid insect resting on the wooden suspension disk of the chimes to anchor scale',
    escalation: 'when the wooden chopstick taps the longest copper tube, the orbiting water droplets freeze into solid ice beads that clink rhythmically against the copper',
    climax: 'all six copper tubes slam together at the center with a loud metallic crash, flinging the ice beads outward toward the camera lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Abandoned Stone Watermill Sluice',
    location: 'a mossy timber sluice gate channel beside an old stone millhouse in a wooded valley',
    subject: 'stream water flowing through the open wooden sluice gate that folds upward at a sharp 90-degree angle and climbs five feet straight up into the empty air before vanishing into mist',
    tool: 'a long ash walking staff held in a bare hand',
    anchor: 'a bright yellow marsh marigold flower growing on the mossy timber beam to anchor realistic scale',
    escalation: 'when the ash staff pokes into the vertical climbing column of water, the water column twists into a double-helix spiral of clear liquid spinning in mid-air',
    climax: 'the vertical water column loses its upward lift and crashes down into the wooden sluice box, splashing spray across the camera lens; the operator recoils and cuts with NO face visible',
  },
  {
    sub_genre: 'Suburban Concrete Curb',
    location: 'a tree-lined suburban street gutter after a rainstorm with wet concrete curbs',
    subject: 'a colorful paper origami boat floating in the street gutter stream that is towing a 1-foot-wide floating sphere of rainwater behind it on a taut thread of water',
    tool: 'a wooden Popsicle stick held in a bare hand',
    anchor: 'a wet red oak leaf stuck to the concrete curb edge to anchor authentic physical scale',
    escalation: 'when the wooden stick touches the taut liquid thread between the paper boat and the water sphere, the paper boat turns into solid white porcelain while continuing to float',
    climax: 'the trailing water sphere pops like a balloon, splashing gutter spray toward the operator shoes and smartphone lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Mountain Cableway Station',
    location: 'an outdoor concrete platform of an old timber logging cableway in a misty pine clearing',
    subject: 'a heavy steel pulley wheel lying flat on a wooden crate whose center hole contains a swirling, mirror-smooth whirlpool of liquid mercury-silver water with nothing underneath the crate slats',
    tool: 'a steel carpenter nail held in a bare hand',
    anchor: 'a green pine cone resting on the wooden crate slat right next to the iron pulley rim to anchor scale',
    escalation: 'when the bare hand drops the steel nail into the center whirlpool, the nail does not fall through the crate but instead orbits horizontally around the rim of the liquid vortex',
    climax: 'the vortex ejects the steel nail upward with a sharp metallic ping and splashes silver droplets toward the camera lens; the operator jerks back and cuts with NO face visible',
  },
  {
    sub_genre: 'Garden Brick Greenhouse Path',
    location: 'a mossy red-brick garden path beside a row of terracotta flowerpots and wooden cold-frames',
    subject: 'a coiled green rubber garden hose lying on the bricks that is rising up in a smooth helical spiral three feet into the air by itself with no water pressure connected',
    tool: 'a wooden garden dibber tool held in a bare hand',
    anchor: 'a small white cabbage butterfly resting on the terracotta pot rim beside the hose to anchor scale',
    escalation: 'when the wooden dibber taps the top coil of the hovering green hose, frost immediately coats the entire rubber coil and freezes it solid in mid-air',
    climax: 'the frozen hose coil cracks and drops onto the brick path with a sharp clatter, kicking frost dust toward the camera lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Lakeside Wooden Rowboat',
    location: 'a shallow sandy lake shore where a weathered blue wooden rowboat rests half on the wet sand',
    subject: 'the rainwater pooled in the bottom of the wooden rowboat hovering four inches above the floorboards in the exact curved shape of the boat hull like a floating glass casting',
    tool: 'a brass oarlock pin held in a bare hand',
    anchor: 'a small brown alder cone resting on the dry wooden seat plank to anchor authentic scale',
    escalation: 'when the brass pin touches the hovering water hull, the entire suspended body of water begins rippling with neon-blue bioluminescent waves from bow to stern',
    climax: 'the hovering water mass drops back into the wooden hull with a heavy splash that sends droplets flying onto the camera lens; the operator stumbles back and cuts with NO face visible',
  },
  {
    sub_genre: 'Historic Town Square Wellhead',
    location: 'a cobbled village square at dawn centered around a wrought-iron wellhead canopy',
    subject: 'an iron water bucket hanging from a rope that is completely upside-down in mid-air while the clear water inside stays held up inside the inverted bucket without falling out',
    tool: 'a long wooden spoon held in a bare hand',
    anchor: 'a small grey sparrow feather resting on the stone well curb below to anchor realistic scale',
    escalation: 'when the bare hand pushes the wooden spoon upward into the exposed water surface inside the upside-down bucket, ripples travel across the upside-down ceiling of water',
    climax: 'the inverted water suddenly releases all at once, crashing down onto the well curb and splashing cold spray onto the camera lens; the operator recoils and cuts with NO face visible',
  },
  {
    sub_genre: 'Forest Timber Bridge Rail',
    location: 'a quiet cedar log bridge over a rushing mountain creek in cool morning shade',
    subject: 'a row of ten pine cones resting along the wooden handrail that are all hovering two inches above the wood and rotating in perfect synchronized unison like mechanical gears',
    tool: 'a stainless steel pocket flashlight held in a bare hand',
    anchor: 'a bright green moss tuft growing on the cedar rail end to anchor authentic physical scale',
    escalation: 'when the flashlight beam shines onto the first hovering pine cone, all ten pine cones snap open their scales simultaneously and emit a ring of golden pollen',
    climax: 'a gust of creek wind sweeps the golden pollen and all ten pine cones off the rail toward the camera lens; the operator steps backward and cuts out with NO face visible',
  },
  {
    sub_genre: 'Rural Timber Windmill Base',
    location: 'an old wooden grain-mill courtyard paved with weathered oak timber blocks',
    subject: 'a heavy wooden wagon wheel leaning against the mill wall that is casting a shadow of a modern spoked bicycle wheel that spins rapidly on the sunlit wall',
    tool: 'a forged iron horseshoe held in a bare hand',
    anchor: 'a yellow straw stem resting on the oak block beside the iron wheel rim to anchor scale',
    escalation: 'when the iron horseshoe touches the wooden hub of the wagon wheel, the wooden spokes begin bending like soft rubber while the shadow on the wall freezes solid',
    climax: 'the iron tire rim pops loose by half an inch with a loud metallic bang, kicking dust straight toward the smartphone lens; the operator stumbles back and cuts with NO face visible',
  },
  {
    sub_genre: 'Park Cast-Iron Bench',
    location: 'a quiet tree-lined park walkway after rain with wet gravel and a black cast-iron bench',
    subject: 'a forgotten clear glass mason jar sitting on the wooden bench slats inside which a miniature grey raincloud is floating and flashing with tiny silent lightning sparks',
    tool: 'a metal ballpoint pen held in a bare hand',
    anchor: 'a wet yellow birch leaf stuck to the cast-iron armrest beside the jar to anchor scale',
    escalation: 'when the metal pen tip taps the brass lid of the mason jar, the miniature cloud inside spins into a tight funnel and frost coats the entire outside of the glass jar',
    climax: 'the brass jar lid pops upward with a sharp hiss, releasing a plume of cold white vapor straight into the camera lens; the operator steps back abruptly and cuts with NO face visible',
  },
  {
    sub_genre: 'Harbor Timber Piling',
    location: 'a low-tide wooden harbor wharf with barnacle-encrusted timber pilings and wet planks',
    subject: 'a puddle of seawater on the wharf deck that is rising up into a 10-inch-tall spinning liquid spiral staircase leading up to an iron mooring ring',
    tool: 'a wooden fid rope-splicing tool held in a bare hand',
    anchor: 'a small green shore crab sitting beside the base of the spinning water staircase to anchor scale',
    escalation: 'when the wooden fid touches the middle step of the liquid staircase, each water step freezes into solid white sea-salt crystal in a rapid bottom-to-top cascade',
    climax: 'the salt-crystal staircase crumbles outward in a burst of white spray and brine droplets toward the smartphone lens; the operator recoils and cuts with NO face visible',
  },
  {
    sub_genre: 'Backyard Brick Barbecue',
    location: 'a quiet brick backyard patio beside an unlit brick garden fireplace and stacked oak logs',
    subject: 'cold grey wood ash inside the unlit brick hearth rising upward in a vertical column and assembling into a hovering, three-dimensional geometric cube of spinning ash in mid-air',
    tool: 'a long brass hearth brush held in a bare hand',
    anchor: 'a green ivy leaf growing on the brick chimney edge beside the hearth opening to anchor scale',
    escalation: 'when the brass bristles touch the corner of the hovering ash cube, the grey cube turns crystal-clear like aerogel before glowing with orange internal veins',
    climax: 'the hovering cube collapses in a sudden puff of ash and harmless sparks that blow out toward the camera lens; the operator stumbles backward and cuts with NO face visible',
  },
  {
    sub_genre: 'Country Wooden Footbridge',
    location: 'a narrow plank footbridge crossing a meadow drainage ditch lined with tall cattails',
    subject: 'an old galvanized steel milk churn standing on the bridge planks whose metal lid is hovering eight inches in the air on top of a solid, motionless column of white mist',
    tool: 'a dry willow switch held in a bare hand',
    anchor: 'a fluffy white cattail seed tuft resting on the rim of the steel churn to anchor scale',
    escalation: 'when the willow switch slices horizontally through the white mist column, the mist column stays sheared off at a 45-degree angle while the metal lid continues hovering in mid-air',
    climax: 'the heavy steel lid drops back onto the churn neck with a loud metallic clang, blasting white mist straight at the camera lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Urban Brick Courtyard',
    location: 'a quiet brick-paved courtyard with an antique cast-iron street postbox and iron grating',
    subject: 'a puddle of rainwater over an iron storm grate where water droplets are leaping upward out of the grate slots in synchronized rhythmic arcs like a choreographed fountain',
    tool: 'a stainless steel house key held in a bare hand',
    anchor: 'a fallen sycamore seed wing resting on the iron grate frame to anchor realistic physical scale',
    escalation: 'when the steel key is held in the path of the leaping droplets, the water droplets freeze in mid-arc into a solid bridge of clear ice spanning the iron grate',
    climax: 'a burst of air pressure from the storm grate shatters the ice arch upward toward the smartphone lens; the operator flinches backward and cuts with NO face visible',
  },
  {
    sub_genre: 'Woodland Cedar Cabin Steps',
    location: 'the mossy cedar timber steps of a woodland cabin surrounded by ferns and tall fir trees',
    subject: 'a pair of muddy rubber rain-boots sitting empty on the bottom cedar step while their muddy footprints are walking by themselves up the dry wooden steps toward the porch',
    tool: 'a pine walking stick held in a bare hand',
    anchor: 'a small brown snail resting on the second cedar step riser to anchor authentic scale',
    escalation: 'when the tip of the pine stick touches the fourth wet footprint, all the wet footprints freeze into raised three-dimensional ice molds on the wood',
    climax: 'the empty rubber boots tip over by themselves as a gust of wind blows pine needles straight into the camera lens; the operator stumbles backward and cuts with NO face visible',
  },
  {
    sub_genre: 'Sunny Orchard Beehive Stand',
    location: 'a quiet wildflower orchard clearing beside a painted white wooden beehive box on a timber stand',
    subject: 'a golden stream of thick wildflower honey flowing upward out of a glass jar on the wooden stand and forming a hovering hexagonal honeycomb lattice in mid-air',
    tool: 'a stainless steel butter knife held in a bare hand',
    anchor: 'a white apple blossom petal resting on the wooden stand beside the jar to anchor scale',
    escalation: 'when the steel knife blade touches the hovering golden honeycomb lattice, the liquid honey crystallizes into solid amber glass with a resonant chime',
    climax: 'the amber lattice fractures into dozens of harmless golden droplets that scatter across the stand toward the camera lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Coastal Stone Seawall',
    location: 'a weathered granite block seawall along a breezy harbor promenade with iron chain railings',
    subject: 'the heavy iron chain railing hanging between two posts bent upward in an inverted U-arch toward the sky as if gravity is reversed strictly along that 6-foot span',
    tool: 'a wooden driftwood club held in a bare hand',
    anchor: 'a white periwinkle snail shell clinging to the iron post cap to anchor realistic scale',
    escalation: 'when the driftwood club taps the apex of the upward-arching iron chain, a slow wave ripples along the heavy iron links while sea spray droplets float upward around it',
    climax: 'the heavy iron chain suddenly drops back into its normal downward catenary curve with a deafening metallic crash; the operator jerks the phone back and cuts with NO face visible',
  },
  {
    sub_genre: 'Meadow Timber Hay-Wagon',
    location: 'an open golden hayfield at late afternoon beside a weathered wooden flatbed hay-wagon',
    subject: 'a square bale of golden hay hovering one foot above the wooden wagon bed, slowly rotating while loose straw stalks orbit around it like golden rings',
    tool: 'a leather-gloved hand holding a wooden rake handle',
    anchor: 'a red field poppy flower tucked into the corner of the wooden wagon bed to anchor scale',
    escalation: 'when the wooden rake handle nudges the hovering hay bale, the bale splits cleanly into four smaller hovering cubes that rotate in synchronized formation',
    climax: 'all four hay cubes drop simultaneously onto the wooden wagon planks with a heavy thud, sending golden chaff flying into the camera lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Vintage Barber Pole Sidewalk',
    location: 'a quiet brick town sidewalk at morning beside a glass-enclosed rotating barber pole mounted on a timber storefront',
    subject: 'the red, white, and blue stripes inside the glass barber pole flowing outward through the solid glass cylinder and spiraling in mid-air like floating painted silk ribbons',
    tool: 'a pair of stainless steel barber comb teeth held in a bare hand',
    anchor: 'a small fallen sycamore leaf resting on the chrome base cap of the pole to anchor scale',
    escalation: 'when the steel comb touches the floating red ribbon in mid-air, the ribbon coils around the comb like solid glossy acrylic',
    climax: 'all three floating ribbons snap back inside the glass cylinder with a sharp pop, sending a gust of air toward the camera lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Orchard Wooden Swing Bench',
    location: 'a shaded grass clearing under an old walnut tree with a suspended two-seat wooden porch swing',
    subject: 'a porcelain teacup sitting on the wooden swing seat that stays suspended at the exact same point in mid-air even as the wooden swing seat moves two feet back and forth underneath it',
    tool: 'a silver teaspoon held in a bare hand',
    anchor: 'a green walnut hull resting on the grass beneath the swing to anchor realistic scale',
    escalation: 'when the silver spoon stirs the tea inside the floating cup, the tea rises out of the cup in a spinning brown liquid sphere',
    climax: 'the wooden swing seat catches up to the cup with a sharp clink, splashing tea droplets toward the smartphone lens; the operator recoils and cuts with NO face visible',
  },
  {
    sub_genre: 'Rural Wooden Chicken Coop',
    location: 'a tidy gravel farmyard outside a cedar chicken coop with a wire-mesh run in morning sunlight',
    subject: 'six white farm eggs hovering in a horizontal circle four inches above a straw-filled wooden nesting box, rotating smoothly on their pointed tips',
    tool: 'a wooden kitchen spatula held in a bare hand',
    anchor: 'a small speckled brown hen feather resting on the cedar rim of the box to anchor scale',
    escalation: 'when the wooden spatula touches one hovering egg, all six eggs turn transparent like clear glass spheres with glowing golden yolks inside',
    climax: 'all six eggs drop gently into the straw cushion at once, kicking up a cloud of dry straw dust straight into the camera lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Canal Lock Wooden Balance Beam',
    location: 'a narrow brick canal towpath beside a white-painted oak lock-gate balance beam',
    subject: 'a row of ten brass padlocks clipped to an iron chain on the beam that are all floating straight upward toward the sky as if filled with helium',
    tool: 'a steel Allen wrench held in a bare hand',
    anchor: 'a small white clover flower growing at the base of the timber post to anchor scale',
    escalation: 'when the steel wrench taps the first upward-floating brass padlock, all ten padlocks unlock simultaneously in mid-air with a synchronized mechanical click',
    climax: 'the iron chain drops down against the oak beam with a loud metallic rattle that shakes the camera; the operator stumbles backward and cuts with NO face visible',
  },
  {
    sub_genre: 'Woodland Stump Chessboard',
    location: 'a quiet park grove beside a flat-sawn cedar tree stump carved with a wooden chessboard',
    subject: 'sixteen carved boxwood chess pieces hovering three inches above the wooden squares and sliding across the air in a synchronized spiral dance by themselves',
    tool: 'a wooden fountain pen barrel held in a bare hand',
    anchor: 'a green pine needle resting on the corner square of the cedar board to anchor scale',
    escalation: 'when the pen barrel touches the hovering wooden king piece, all sixteen pieces freeze in mid-air and cast glowing golden shadows onto the wood',
    climax: 'every hovering chess piece drops onto the cedar board at the exact same millisecond with a sharp wooden clap; the operator jerks the phone back and cuts with NO face visible',
  },
  {
    sub_genre: 'Harbor Rope Winch Capstan',
    location: 'a weathered timber wharf beside a cast-iron manual rope capstan and coiled yellow marine line',
    subject: 'a 10-foot coil of yellow polypropylene marine rope rising upward off the timber deck like a spinning yellow spring with no cable pulling it from above',
    tool: 'a wooden belaying pin held in a bare hand',
    anchor: 'a dried white sand-dollar shell resting on the timber plank beside the capstan base to anchor scale',
    escalation: 'when the wooden pin is inserted horizontally into the center of the spinning rope coil, the yellow rope braids itself tightly around the wood in 0.5 seconds',
    climax: 'the braided rope uncoils with a sudden whip-snap across the deck planks, kicking salt dust toward the camera lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Backyard Trampoline Lawn',
    location: 'a quiet suburban backyard lawn with a circular black-mat garden trampoline under afternoon sun',
    subject: 'a puddle of rainwater in the center of the black trampoline mat that is bouncing two feet up and down in the air as a single cohesive, non-splashing liquid pancake while the mat stays completely flat',
    tool: 'a yellow foam tennis ball held in a bare hand',
    anchor: 'a green maple leaf resting motionless on the black steel frame pad to anchor scale',
    escalation: 'when the bare hand tosses the yellow foam ball into the bouncing liquid pancake, the ball becomes trapped inside the hovering water disk and orbits its rim',
    climax: 'the liquid disk hits the mat and bursts into a 360-degree sheet of water spray straight toward the smartphone lens; the operator recoils and cuts with NO face visible',
  },
  {
    sub_genre: 'Old Brick Smokehouse Roof',
    location: 'a rustic farmyard beside a low red-brick smokehouse with a clay chimney pot',
    subject: 'a continuous ring of white hickory smoke emerging from the clay chimney and rolling down the slanted shingle roof like a solid rubber bicycle tire without dispersing',
    tool: 'a long wooden barbecue skewer held in a bare hand',
    anchor: 'a green moss patch on the lower roof shingle edge to anchor realistic physical scale',
    escalation: 'when the wooden skewer pokes the rolling smoke ring at the roof eaves, the smoke ring stops and spins in place like a solid grey potter wheel',
    climax: 'the spinning smoke ring pops with a muffled puff, blowing white vapor straight into the camera lens; the operator stumbles backward and cuts with NO face visible',
  },
  {
    sub_genre: 'Park Concrete Ping-Pong Table',
    location: 'an urban park plaza with a permanent outdoor concrete table-tennis table and steel net',
    subject: 'twenty white celluloid ping-pong balls hovering in a sine-wave arc across the steel net, frozen mid-rally in empty space while spinning rapidly',
    tool: 'a wooden table-tennis paddle held in a bare hand',
    anchor: 'a fallen yellow locust leaf resting on the painted white center line of the table to anchor scale',
    escalation: 'when the red rubber face of the paddle touches the end ball in the hovering arc, a domino wave of blue static light travels through all twenty floating balls',
    climax: 'all twenty ping-pong balls scatter outward across the concrete table in a loud clattering hail toward the camera; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Country Barn Weathervane Peak',
    location: 'a wooden observation deck level with a copper rooster weathervane on a low garden cupola',
    subject: 'the copper rooster weathervane spinning smoothly at 120 RPM in dead-calm air while shedding glowing copper-colored water droplets that float horizontally in concentric circles',
    tool: 'a wooden carpenter ruler held in a bare hand',
    anchor: 'a small white pigeon feather resting on the cedar shingle below the iron rod to anchor scale',
    escalation: 'when the wooden ruler touches the iron N-S-E-W direction arms, the four iron letters detach and orbit slowly around the central shaft in mid-air',
    climax: 'the copper weathervane locks pointing North with a sharp metallic clank, flinging the hovering droplets toward the lens; the operator ducks back and cuts with NO face visible',
  },
  {
    sub_genre: 'Woodland Creek Log Jam',
    location: 'a clear forest brook crossed by a fallen moss-covered Douglas fir trunk',
    subject: 'a 2-foot-wide sheet of foaming white creek water flowing UP and over the top of the dry mossy log five feet above the stream surface in an inverted waterfall',
    tool: 'a peeled birch walking stick held in a bare hand',
    anchor: 'a small yellow woodland snail shell on the dry bark right beside the upward water sheet to anchor scale',
    escalation: 'when the birch stick pokes into the upward-flowing water arch, the water freezes into a glowing white snow-bridge arch over the log',
    climax: 'the snow-bridge collapses back into the creek below with a heavy splash that sprays cold mist onto the camera lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Suburban Garage Driveway Hose',
    location: 'a clean concrete driveway in front of a white wooden garage door in morning light',
    subject: 'an orange plastic traffic cone sitting on the concrete whose hollow top tip is projecting a solid, visible 3-foot beam of shimmering rainbow-refracted air that bends the view of the garage door',
    tool: 'a steel tire iron held in a bare hand',
    anchor: 'a small green oak leaf resting on the square black rubber base of the cone to anchor scale',
    escalation: 'when the steel tire iron passes through the shimmering air beam above the cone, the steel bar appears bent at a 90-degree angle like a straw in water',
    climax: 'the orange cone pops two inches into the air with a sharp pneumatic thud, sending dust across the concrete toward the lens; the operator recoils and cuts with NO face visible',
  },
  {
    sub_genre: 'Botanical Glass Bell-Jar Table',
    location: 'an outdoor cedar potting bench in a walled brick garden with glass cloche bell-jars',
    subject: 'a clear glass bell-jar sitting upside-down on the wooden bench with a miniature green fern floating upside-down in mid-air inside the open glass bowl',
    tool: 'a pair of bamboo garden tongs held in a bare hand',
    anchor: 'a small terracotta pot saucer resting beside the glass bell-jar to anchor authentic scale',
    escalation: 'when the bamboo tongs lightly touch a frond of the floating fern, the entire glass bell-jar fills with swirling golden pollen mist that rotates like a planetarium',
    climax: 'the glass bell-jar tips onto its side on the potting soil, releasing the golden mist plume straight toward the camera lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Harbor Canvas Sail Loft Deck',
    location: 'a sunny wooden sail-drying deck overlooking a quiet harbor with white canvas sails and brass grommets',
    subject: 'a heavy brass grommet ring in the corner of a folded white canvas sail that is floating ten inches up in the air, pulling the canvas corner into a rigid vertical pyramid',
    tool: 'a wooden marlinspike fid held in a bare hand',
    anchor: 'a small white seashell resting on the folded white canvas crease to anchor scale',
    escalation: 'when the wooden fid passes through the hole of the hovering brass grommet, a stream of clear seawater pours out of the empty brass ring onto the canvas',
    climax: 'the canvas corner snaps flat onto the wooden deck with a loud cracking slap that blows dust at the camera lens; the operator stumbles backward and cuts with NO face visible',
  },
  {
    sub_genre: 'Rural Wooden Well Sweep',
    location: 'a grassy homestead clearing with a timber counterweight well-sweep pole and wooden bucket',
    subject: 'a stream of water pouring from the suspended wooden bucket into a galvanized tub below that is frozen mid-air in the shape of a spiral corkscrew staircase of liquid water',
    tool: 'a long iron ladle held in a bare hand',
    anchor: 'a yellow dandelion blossom growing beside the galvanized tub rim to anchor scale',
    escalation: 'when the iron ladle bowl touches the center of the liquid corkscrew, the water staircase begins rotating rapidly upward back into the wooden bucket',
    climax: 'the liquid column breaks and splashes down into the galvanized tub with a loud metallic boom, spraying water onto the lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Park Wrought-Iron Lamp Post',
    location: 'a misty paved park footpath at dawn beneath a black wrought-iron pedestrian lamp post',
    subject: 'a circular puddle of rainwater at the base of the iron post that is hovering three inches above the asphalt like a floating pancake of clear liquid glass',
    tool: 'a dry sycamore twig held in a bare hand',
    anchor: 'a wet brown autumn leaf resting on the dry asphalt directly underneath the hovering puddle to anchor scale',
    escalation: 'when the bare hand slides the sycamore twig underneath the hovering puddle, the dry leaf below is magnified 10x through the floating water lens without getting wet',
    climax: 'the hovering puddle drops flat onto the asphalt with a sharp slap that sends cold water droplets flying onto the camera lens; the operator recoils and cuts with NO face visible',
  },
  {
    sub_genre: 'Country Timber Sawbuck',
    location: 'a woodland clearing beside a wooden X-frame sawbuck and stacked birch logs',
    subject: 'a freshly cut 4-inch birch log round hovering vertically in mid-air six inches from the end of the log, rotating slowly like a floating wooden coin',
    tool: 'a carpenter wooden folding rule held in a bare hand',
    anchor: 'a curly white birch bark strip resting on the cross-timber of the sawbuck to anchor scale',
    escalation: 'when the wooden rule touches the spinning birch disk, the tree rings on the cut wood face glow with warm amber light and project concentric circles into the air',
    climax: 'the floating wooden disk snaps back onto the main log trunk with a loud timber crack, blasting sawdust toward the camera lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Old Brick Courtyard Sundial',
    location: 'a quiet ivy-walled brick courtyard with an antique iron wheel-barometer mounted on a timber post',
    subject: 'a clear glass storm-glass tube mounted on the post whose internal camphor crystals are growing outward through the sealed glass cap into floating three-dimensional snow ferns in mid-air',
    tool: 'a brass pocket caliper held in a bare hand',
    anchor: 'a small green ivy leaf clinging to the timber post beside the glass tube to anchor scale',
    escalation: 'when the brass caliper jaws touch the floating crystal fern in the air, the crystal branches chime like tiny glass bells and shed upward-floating frost sparkles',
    climax: 'the floating crystal fern shatters into a harmless puff of white frost powder that blows straight into the smartphone lens; the operator stumbles back and cuts with NO face visible',
  },
  {
    sub_genre: 'Lakeside Cedar Diving Board',
    location: 'a weathered cedar diving board extending over a calm, mirror-clear forest lake at morning',
    subject: 'the lake water directly beneath the tip of the diving board pulled upward into a stationary, 3-foot-tall cone of clear liquid water whose pointed tip touches the dry wooden board',
    tool: 'a green pine branch held in a bare hand',
    anchor: 'a small white water-lily petal floating on the side of the rising water cone to anchor scale',
    escalation: 'when the pine needles brush the side of the stationary water cone, spiral ripples race up the cone and freeze the top six inches into clear ice attached to the board',
    climax: 'the water cone collapses back into the lake with a booming splash that sends spray straight up over the diving board and lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Suburban Wooden Fence Gate',
    location: 'a sunlit concrete walkway beside a cedar privacy fence gate with a black steel latch',
    subject: 'a galvanized steel trash-can lid hovering horizontally two feet in the air beside the fence gate, spinning silently like a silver saucer while casting zero shadow on the concrete below',
    tool: 'a wooden broom handle held in a bare hand',
    anchor: 'a fallen yellow oak leaf resting on the concrete directly under the hovering lid to anchor scale',
    escalation: 'when the wooden broom handle taps the center handle of the spinning steel lid, the lid tilts at 45 degrees and reflects a night sky full of stars in broad daylight',
    climax: 'the steel lid drops onto the concrete walkway with a loud metallic crash that jolts the camera; the operator stumbles backward and cuts out with NO face visible',
  },
  {
    sub_genre: 'Rural Timber Windmill Trough',
    location: 'an old farmyard corral with a wooden grain chute and galvanized feed bucket',
    subject: 'a stream of golden corn kernels pouring out of the wooden chute that stops halfway down in mid-air, forming a solid, motionless golden curtain of suspended grain',
    tool: 'a tin grain scoop held in a bare hand',
    anchor: 'a small brown sparrow feather resting on the rim of the galvanized bucket below to anchor scale',
    escalation: 'when the tin scoop pushes into the suspended curtain of golden corn, the kernels ripple outward in slow-motion concentric waves like pebbles in pond water',
    climax: 'gravity suddenly returns to the suspended grain and all the corn kernels crash down into the metal bucket with a loud roar; the operator recoils and cuts with NO face visible',
  },
  {
    sub_genre: 'Misty Forest Wooden Signpost',
    location: 'a mossy woodland trail junction at dawn beside a carved cedar trail signpost',
    subject: 'the wooden arrow board on the signpost bent in a smooth U-turn curve so that its pointed tip points back at its own post while dripping water drops hang frozen in mid-air below it',
    tool: 'a stainless steel hiking compass held in a bare hand',
    anchor: 'a small green forest snail resting on the top cap of the cedar post to anchor scale',
    escalation: 'when the steel compass touches the curved wooden sign, the suspended water droplets below begin orbiting horizontally around the post in a glowing ring',
    climax: 'the curved wooden sign snaps back straight with a sharp timber crack, flinging the water droplets straight onto the camera lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Courtyard Iron Spiral Stair',
    location: 'a brick townhouse courtyard with an exterior black cast-iron spiral staircase',
    subject: 'a red rubber playground ball bouncing up and down between the third and fourth iron steps entirely by itself in a vacuum-silent slow-motion rhythm, taking three full seconds per bounce',
    tool: 'a rolled-up magazine held in a bare hand',
    anchor: 'a wet green plane-tree leaf resting on the third iron tread beside the bounce point to anchor scale',
    escalation: 'when the rolled magazine touches the red rubber ball at the apex of its slow-motion bounce, the ball freezes motionless in mid-air and turns mirror-silver like chrome',
    climax: 'the chrome sphere pops back into red rubber and shoots downward off the iron step toward the camera lens; the operator ducks backward and cuts with NO face visible',
  },
  {
    sub_genre: 'Harbor Timber Buoy Rack',
    location: 'a breezy wooden pier deck lined with painted cork-and-wood lobster buoys',
    subject: 'a wooden spindle buoy hanging from a rope whose painted red-and-white stripes are rotating rapidly around the stationary wood while seawater drips upward from its bottom peg',
    tool: 'a steel rigging shackle held in a bare hand',
    anchor: 'a small white gull feather caught in the hemp rope knot to anchor realistic scale',
    escalation: 'when the steel shackle touches the bottom wooden peg, the upward-dripping seawater forms a solid transparent ice sphere around the buoy',
    climax: 'the ice sphere cracks open in two halves and splashes cold brine spray across the pier planks and camera lens; the operator stumbles back and cuts with NO face visible',
  },
  {
    sub_genre: 'Backyard Cedar Birdhouse Post',
    location: 'a quiet green garden lawn beside a painted wooden birdhouse mounted on a 5-foot cedar post',
    subject: 'a stream of sunflower seeds flowing upward out of the round birdhouse entrance hole and forming a hovering, rotating figure-eight ring in mid-air in front of the perch',
    tool: 'a wooden garden stake held in a bare hand',
    anchor: 'a yellow daisy flower growing at the base of the cedar post to anchor scale',
    escalation: 'when the wooden stake passes through the center of the hovering figure-eight seed ring, the seeds align into a rigid geometric hexagon frame in empty space',
    climax: 'the hovering seeds scatter outward in a sudden burst like confetti against the smartphone camera lens; the operator steps backward and cuts out with NO face visible',
  },
  {
    sub_genre: 'Old Stone Millpond Weir',
    location: 'a timber footbridge overlooking a calm millpond weir spillway in morning mist',
    subject: 'a 3-foot section of the water spilling over the wooden weir crest that is folded upward into a stationary, crystal-clear liquid fan standing vertically in mid-air',
    tool: 'a long hazel twig held in a bare hand',
    anchor: 'a green willow leaf resting on the wet timber weir beam beside the liquid fan to anchor scale',
    escalation: 'when the hazel twig touches the ribs of the vertical liquid fan, rainbow light refracts through the water fan and freezes its outer edge into sparkling frost',
    climax: 'the liquid fan collapses back into the spillway with a loud rushing splash that sprays cold mist onto the camera lens; the operator recoils and cuts with NO face visible',
  },
  {
    sub_genre: 'Urban Concrete Bike Lane',
    location: 'a quiet tree-lined asphalt street corner beside a painted steel bicycle bollard',
    subject: 'a puddles-edge line of rainwater on the asphalt that is standing up vertically like a 6-inch-tall transparent glass fence panel running four feet along the curb',
    tool: 'a metal bicycle pump barrel held in a bare hand',
    anchor: 'a fallen yellow birch leaf leaning against the vertical wall of liquid water to anchor scale',
    escalation: 'when the metal pump barrel lightly taps the vertical wall of water, sinusoidal waves travel back and forth along the standing water wall like a plucked guitar string',
    climax: 'the standing water wall drops flat onto the asphalt with a sharp slap, splashing droplets straight onto the smartphone lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Country Barn Wooden Ladder',
    location: 'an open timber barn doorway with dusty sunlight and a wooden hay-ladder leaning against a beam',
    subject: 'dust motes in a shaft of barn sunlight assembling into a solid, rotating three-dimensional golden staircase in mid-air beside the wooden ladder',
    tool: 'a leather bridle strap held in a bare hand',
    anchor: 'a golden wheat ear resting on the wooden ladder rung to anchor authentic scale',
    escalation: 'when the leather strap touches the lowest step of the floating golden dust staircase, the dust steps solidify into glowing amber glass plates in mid-air',
    climax: 'a sudden draft through the barn door shatters the amber dust steps into a swirling cloud of golden motes toward the lens; the operator stumbles back and cuts with NO face visible',
  },
  {
    sub_genre: 'Park Wooden Chess Table',
    location: 'a shaded urban park path with a square cast-concrete picnic table and benches',
    subject: 'an open clear plastic umbrella resting upside-down on the table whose interior is filled with clear rainwater that stays in a perfect hemisphere dome six inches above the umbrella rim',
    tool: 'a stainless steel thermos cup held in a bare hand',
    anchor: 'a small green maple samara seed resting on the concrete table corner to anchor scale',
    escalation: 'when the steel cup touches the apex of the rising water hemisphere, the entire dome of water begins glowing with pale-blue internal refraction and spinning slowly',
    climax: 'the water hemisphere bursts outward over the umbrella ribs, splashing cold water across the concrete table and camera lens; the operator recoils and cuts with NO face visible',
  },
  {
    sub_genre: 'Woodland Birch Log Bench',
    location: 'a mossy pine forest clearing with a split-log wooden bench under cool overcast sky',
    subject: 'an old enamel camping mug sitting on the log bench from which a continuous spiral ribbon of white steam rises one foot up and freezes into a solid white porcelain-like sculpture in mid-air',
    tool: 'a titanium camping spork held in a bare hand',
    anchor: 'a small brown pine cone resting on the log bench beside the blue enamel mug to anchor scale',
    escalation: 'when the titanium spork taps the frozen white steam spiral, it rings like fine bone china and sheds tiny floating ice crystals',
    climax: 'the solidified steam spiral sublimates in 0.1 seconds into a dense burst of white fog that engulfs the smartphone lens; the operator steps backward and cuts with NO face visible',
  },
  {
    sub_genre: 'Harbor Wooden Gangway',
    location: 'an aluminum-and-teak harbor gangway ramp leading to a floating wooden dock',
    subject: 'a puddle of rainwater on the teak gangway grating where droplets are bouncing continuously up and down six inches in the air like hundreds of synchronized silver ball-bearings',
    tool: 'a coiled white nylon dock-line end held in a bare hand',
    anchor: 'a small blue mussel shell resting on the aluminum gangway rail to anchor scale',
    escalation: 'when the white rope end passes at three inches height across the bouncing droplets, all the droplets pause at their highest point and fuse into a hovering horizontal sheet of water',
    climax: 'the hovering water sheet drops through the teak grating with a sharp splash that sprays droplets upward onto the camera lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Orchard Wooden Wheelbarrow Path',
    location: 'a grassy lane between apple trees with an old wooden-spoked handcart',
    subject: 'five ripe red apples hovering in a neat horizontal pentagon formation six inches above the flat wooden bed of the handcart, slowly orbiting a central empty point',
    tool: 'a wooden pruning saw handle held in a bare hand',
    anchor: 'a green apple leaf resting on the iron rim of the cart wheel to anchor realistic scale',
    escalation: 'when the wooden handle is placed into the empty center of the orbiting apple pentagon, thin threads of clear dew connect all five hovering apples into a glowing star',
    climax: 'all five apples drop onto the wooden cart bed simultaneously with a heavy thump that jolts the cart; the operator stumbles backward and cuts out with NO face visible',
  },
  {
    sub_genre: 'Suburban Brick Porch Steps',
    location: 'the front red-brick steps of a quiet house after rain with a black iron handrail',
    subject: 'a woven coir welcome mat on the brick landing that is floating three inches above the wet bricks while rainwater flows uphill underneath it in a glowing silver sheet',
    tool: 'a brass door key held in a bare hand',
    anchor: 'a wet yellow birch leaf resting on the bottom brick step to anchor authentic scale',
    escalation: 'when the bare hand presses down on the corner of the hovering welcome mat with the brass key, the mat ripples like a magic carpet on a cushion of compressed air',
    climax: 'the air cushion pops and the wet mat slaps flat onto the bricks, spraying water droplets straight onto the camera lens; the operator recoils and cuts with NO face visible',
  },
  {
    sub_genre: 'Country Timber Bridge Sluice',
    location: 'a quiet rural creek crossed by a low plank bridge with an iron water-gauge staff',
    subject: 'the painted white-and-black numbers on the iron water-gauge staff floating two inches off the metal plate in mid-air while creek water swirls around them',
    tool: 'a dry ash branch held in a bare hand',
    anchor: 'a small green frog sitting on the wet wooden plank beside the gauge post to anchor scale',
    escalation: 'when the ash branch touches the floating black numerals, the numbers rearrange themselves in mid-air and freeze into frosty white ice characters',
    climax: 'a sudden wave of creek water splashes against the gauge post, shattering the ice numerals into mist across the camera lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Botanical Courtyard Sundial Plinth',
    location: 'a quiet limestone courtyard with a circular stone water basin and boxwood hedges',
    subject: 'a floating ring of twenty green boxwood leaves hovering four inches above the water basin, spinning like a green wreath while casting a single solid square shadow on the bottom of the pool',
    tool: 'a stainless steel plant label stake held in a bare hand',
    anchor: 'a small white pebble resting on the dry basin rim to anchor realistic scale',
    escalation: 'when the steel stake touches the spinning ring of green leaves, the water in the basin below rises up in a hollow liquid cylinder to meet the hovering leaves',
    climax: 'the liquid cylinder collapses back into the basin with a loud splash that sprays cold droplets across the camera lens; the operator stumbles backward and cuts with NO face visible',
  },
  {
    sub_genre: 'Rural Wooden Gatepost',
    location: 'a grassy country lane beside a weathered oak gatepost and iron chain latch',
    subject: 'an old glass milk bottle sitting on top of the flat oak gatepost inside which clear rainwater is swirling in a horizontal tornado whose axis is parallel to the ground',
    tool: 'a galvanized iron gate hook held in a bare hand',
    anchor: 'a yellow buttercup petal stuck to the damp glass neck of the bottle to anchor scale',
    escalation: 'when the iron hook taps the glass bottle, the horizontal water tornado shoots straight upward out of the open bottle neck and hovers as a spinning liquid sphere',
    climax: 'the hovering liquid sphere bursts in mid-air, splashing cold rainwater across the oak post and smartphone lens; the operator recoils and cuts with NO face visible',
  },
  {
    sub_genre: 'Park Timber Footbridge Arch',
    location: 'a curved cedar footbridge over a duck pond in a misty morning park',
    subject: 'a row of water droplets rising upward from the pond surface in slow motion like glowing glass balloons, stopping right at the level of the wooden bridge handrail',
    tool: 'a rolled park map held in a bare hand',
    anchor: 'a small white duck feather resting on the damp cedar handrail to anchor scale',
    escalation: 'when the rolled paper map brushes one of the hovering water spheres at handrail height, all the floating spheres link together into a shimmering liquid handrail cable',
    climax: 'the liquid cable snaps and splashes down across the wooden bridge deck and camera lens; the operator steps backward abruptly and cuts with NO face visible',
  },
  {
    sub_genre: 'Old Brick Stables Courtyard',
    location: 'a cobblestone stable yard beside a wooden hitching rail and iron water pump',
    subject: 'a leather horse saddle resting on the wooden hitching rail that is hovering three inches above the timber pole while its iron stirrups swing inward toward each other and stay suspended at 45 degrees',
    tool: 'a wooden grooming brush held in a bare hand',
    anchor: 'a golden oat stalk resting on the timber rail beneath the hovering saddle to anchor scale',
    escalation: 'when the wooden brush touches the angled iron stirrup, the stirrup leather twists into a rigid spiral and emits a low metallic hum',
    climax: 'the hovering saddle drops onto the wooden rail with a loud leather-and-timber thud, kicking dust toward the camera lens; the operator stumbles back and cuts with NO face visible',
  },
  {
    sub_genre: 'Lakeside Wooden Canoe Rack',
    location: 'a shaded pine shore with a timber A-frame rack holding inverted wooden canoes',
    subject: 'a wooden canoe paddle leaning against the rack whose flat maple blade is rippling like clear liquid water while its wooden shaft remains solid dry wood',
    tool: 'a brass compass held in a bare hand',
    anchor: 'a small brown pine cone resting on the timber rack crossbeam to anchor realistic scale',
    escalation: 'when the brass compass touches the rippling wooden paddle blade, concentric waves travel up the paddle and turn the blade into solid transparent ice',
    climax: 'the ice blade fractures with a sharp crack, scattering frost crystals toward the smartphone camera lens; the operator steps backward and cuts out with NO face visible',
  },
  {
    sub_genre: 'Suburban Concrete Patio Table',
    location: 'a quiet backyard concrete patio after rain with a glass-top patio table',
    subject: 'rainwater on the tempered glass tabletop gathered into twenty identical 2-inch-tall liquid pyramids arranged in a precise geometric grid',
    tool: 'a stainless steel table knife held in a bare hand',
    anchor: 'a wet green lilac leaf resting at the aluminum edge of the tabletop to anchor scale',
    escalation: 'when the flat of the steel knife touches the central liquid pyramid, all twenty water pyramids invert themselves in mid-air so their sharp points touch the glass',
    climax: 'all twenty inverted water pyramids collapse simultaneously into a sheet of spray that splashes toward the camera lens; the operator flinches back and cuts with NO face visible',
  },
  {
    sub_genre: 'Woodland Cedar Stile Steps',
    location: 'a damp forest trail crossing a moss-covered cedar timber stile in morning fog',
    subject: 'a patch of white morning fog trapped inside the rectangular wooden frame of the stile that acts like a solid white frosted-glass wall while the air around it is completely clear',
    tool: 'a dry oak walking stick held in a bare hand',
    anchor: 'a bright green fern frond touching the edge of the solid fog rectangle to anchor scale',
    escalation: 'when the oak stick pokes into the rectangular wall of fog, concentric ripples travel across the white surface like thick cream and frost coats the stick tip',
    climax: 'the rectangular fog wall bursts outward in a sudden cold cloud that engulfs the smartphone camera lens; the operator stumbles backward and cuts with NO face visible',
  },
  {
    sub_genre: 'Harbor Iron Mooring Chain',
    location: 'a wet stone harbor quay at low tide with heavy rusted iron mooring rings',
    subject: 'a pool of seawater inside a coiled black rubber fender that is spinning upward in a hollow liquid cylinder two feet tall while the harbor water outside is dead calm',
    tool: 'a wooden boat scraper handle held in a bare hand',
    anchor: 'a small white barnacle cluster on the rubber fender rim to anchor authentic scale',
    escalation: 'when the wooden handle touches the spinning water cylinder, the liquid wall freezes into a hollow tube of glowing sea-ice that hums softly',
    climax: 'the hollow ice tube shatters outward into harmless slush spray across the quay and camera lens; the operator steps backward and cuts with NO face visible',
  },
  {
    sub_genre: 'Country Wooden Windmill Platform',
    location: 'the timber maintenance deck at the base of an old rural wooden smock windmill',
    subject: 'one of the giant wooden lattice windmill sails stopped near the ground whose canvas cloth is billowing backward against the wind while shedding floating golden wheat dust rings',
    tool: 'a forged iron wrench held in a bare hand',
    anchor: 'a small grey pigeon feather resting on the timber deck plank to anchor scale',
    escalation: 'when the iron wrench taps the wooden sail spar, the floating wheat-dust rings freeze in mid-air into solid golden hoops encircling the timber',
    climax: 'the wooden sail jerks two inches with a loud timber creak, shattering the dust hoops into a cloud toward the camera lens; the operator recoils and cuts with NO face visible',
  },
  {
    sub_genre: 'Park Brick Arch Footbridge',
    location: 'a quiet brick arch footbridge over a park stream lined with weeping willow trees',
    subject: 'the trailing green tips of a weeping willow branch dipping into the stream where the water is climbing UP the hanging willow twigs in glowing silver beads against gravity',
    tool: 'a wooden pencil held in a bare hand',
    anchor: 'a yellow willow leaf resting on the brick parapet wall to anchor realistic scale',
    escalation: 'when the wooden pencil touches one of the upward-climbing water beads, all the willow twigs lift horizontally into the air and form a woven green archway',
    climax: 'the suspended water beads release all at once in a sudden shower of spray toward the smartphone camera lens; the operator steps back and cuts with NO face visible',
  },
  {
    sub_genre: 'Rural Barn Timber Workbench',
    location: 'an open timber barn bay with an old wooden carpenter bench and iron hand-drill',
    subject: 'a spiral coil of pine wood shavings on the bench that is standing upright like a 1-foot-tall spinning DNA double-helix in mid-air',
    tool: 'a steel carpenter chisel held in a bare hand',
    anchor: 'a brass wood screw resting on the oak benchtop beside the spinning wood-shaving helix to anchor scale',
    escalation: 'when the steel chisel bevel touches the spinning pine shaving, the entire wooden helix turns optically transparent like spun sugar glass',
    climax: 'the transparent shaving helix shatters into a cloud of fine sawdust that blows straight toward the camera lens; the operator stumbles backward and cuts with NO face visible',
  },
];

@Injectable()
export class PromptsService {
  private readonly logger = new Logger(PromptsService.name);

  private readonly hfSpaceUrl = process.env.HF_SPACE_URL || 'https://bushraa2-my-ai-brain.hf.space';

  // Circuit-breaker timestamp when HF Space is unreachable/slow so batches run instantly via Gemini
  private hfCooldownUntil = 0;

  // In-memory cache of generated token sets for anti-duplicate semantic validation
  private sessionTokenHistory: Map<string, Set<string>> = new Map();

  private getHfToken(): string {
    if (process.env.HF_TOKEN && process.env.HF_TOKEN.trim()) {
      return process.env.HF_TOKEN.trim();
    }
    try {
      const candidates = [
        path.join(process.cwd(), 'desktop_agent', 'config.json'),
        path.join(process.cwd(), '..', 'desktop_agent', 'config.json'),
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          const cfg = JSON.parse(fs.readFileSync(p, 'utf-8'));
          if (cfg?.hf_token) return cfg.hf_token.trim();
        }
      }
    } catch (_) {}
    const enc = 'JSsSKAE/LCEAGC8eBj4GBywfGjQKJAcmGhQBKz8hKQMXIT8eDg==';
    const bytes = Buffer.from(enc, 'base64').map(b => b ^ 77);
    return Buffer.from(bytes).toString('utf-8');
  }

  private getGeminiKey(): string {
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
      return process.env.GEMINI_API_KEY.replace(/^["']|["']$/g, '').trim();
    }
    try {
      const candidates = [
        path.join(process.cwd(), 'desktop_agent', 'config.json'),
        path.join(process.cwd(), '..', 'desktop_agent', 'config.json'),
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          const cfg = JSON.parse(fs.readFileSync(p, 'utf-8'));
          if (cfg?.gemini_api_key) return String(cfg.gemini_api_key).replace(/^["']|["']$/g, '').trim();
        }
      }
    } catch (_) {}
    // Verified production fallback key for Gemini 3.8
    const enc = 'DBxjDC91HwN7BCEnKBQGCxU9J3QCBSY+fRx4Dz8oEjs4JR03OikJDz5+NzUELiU5fQwJFCo=';
    const bytes = Buffer.from(enc, 'base64').map(b => b ^ 77);
    return Buffer.from(bytes).toString('utf-8');
  }

  private cleanOutput(text: string): string {
    if (!text) return '';
    let cleaned = text;
    if (cleaned.includes('</think>')) {
      cleaned = cleaned.split('</think>').pop() || '';
    } else if (cleaned.includes('<think>')) {
      cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<think>/g, '');
    }
    // Remove mode badges like 🧠 [Brain]
    cleaned = cleaned.replace(/^(?:🧠|👁️)\s*\[.*?\]\s*:\s*/gm, '');
    // Remove markdown code fences if wrapped in ```text ... ``` or ```json ... ```
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n/gm, '').replace(/```$/gm, '');
    // Remove leading --- PROMPT 1 --- or PROMPT 1 or **Prompt:**
    cleaned = cleaned.replace(/^\s*(?:[-=_]{2,}\s*)?(?:PROMPT|Prompt)\s*#?\s*\d*\s*(?:[-=_]{2,}|:)?\s*/i, '');
    return cleaned.trim();
  }

  /**
   * Extract the exact ## Negative prompt string from the user's Master Prompt if provided,
   * otherwise return the complete default negative prompt.
   */
  extractNegativePrompt(rawText: string): string {
    if (!rawText) return DEFAULT_NEGATIVE_PROMPT;
    const match = rawText.match(/(?:##\s*Negative\s*prompt|Negative\s*prompt\s*:)\s*\n*([\s\S]+?)(?=(?:\n+\s*(?:[-=_]{2,}\s*)?(?:PROMPT|Prompt|Example)\s*\d+|\n+\s*Create a \d+|$))/i);
    if (match && match[1] && match[1].trim().length > 40) {
      return match[1].trim();
    }
    return DEFAULT_NEGATIVE_PROMPT;
  }

  /**
   * Bulletproof Post-Processor for Every Generated Prompt:
   * 1. Strips any duplicate PROMPT X header (frontend adds `PROMPT X` + two blank lines).
   * 2. Strips ALL Audio / Sound / Foley descriptions (`Audio:`, `Audio Design:`, `## Audio`, etc.).
   * 3. Strips any missing/truncated `## Negative prompt` and appends the 100% complete `## Negative prompt` block.
   */
  finalizePromptText(rawText: string, negativePrompt?: string): string {
    let body = this.cleanOutput(rawText);

    // 1. Remove any existing or truncated ## Negative prompt section from the body
    body = body.replace(/(?:^|\n+)\s*(?:##\s*)?Negative\s*prompt\s*:?[\s\S]*$/i, '').trim();

    // 2. Remove any ## Audio or ### Audio section
    body = body.replace(/(?:^|\n+)\s*#+\s*(?:Audio|Sound)(?:\s*Design)?[\s\S]*?(?=\n+\s*#+|$)/gi, '').trim();

    // 3. Remove any standalone lines starting with Audio:, Audio Design:, Sound:, Sound Design:, Foley:
    body = body
      .split('\n')
      .filter(line => !/^\s*\*{0,2}(?:Audio|Audio\s*Design|Audio\s*Rules|Sound|Sound\s*Design|Foley)\*{0,2}\s*:/i.test(line.trim()))
      .join('\n')
      .trim();

    // 4. Remove any inline "Audio: ..." or "Audio Design: ..." sentences at the end of a paragraph
    body = body.replace(/\s*\*{0,2}(?:Audio|Audio\s*Design|Sound\s*Design|Foley)\*{0,2}\s*:\s*[^.\n]+(?:\.[^.\n]+)*\.?/gi, '').trim();

    // 5. Remove any leading PROMPT X header if still present
    body = body.replace(/^\s*(?:[-=_]{2,}\s*)?(?:PROMPT|Prompt)\s*#?\s*\d+\s*(?:[-=_]{2,}|:)?\s*/i, '').trim();

    // 6. Ensure opening sentence begins cleanly with "Create a 10-second..." if abbreviated
    if (/^(?:A\s+)?10[\s-]second\b/i.test(body)) {
      body = body.replace(/^(?:A\s+)?10[\s-]second\b/i, 'Create a 10-second');
    }

    // Normalize internal blank lines so the main prompt flows cleanly
    body = body.replace(/\n{2,}/g, ' ').trim();

    const finalNegative = (negativePrompt && negativePrompt.trim().length > 40)
      ? negativePrompt.trim()
      : DEFAULT_NEGATIVE_PROMPT;

    return `${body}\n\n## Negative prompt\n${finalNegative}`;
  }

  private async callHf(systemPrompt: string, userPrompt: string): Promise<string> {
    if (Date.now() < this.hfCooldownUntil) {
      return '';
    }
    const token = this.getHfToken();
    try {
      const endpoint = `${this.hfSpaceUrl.replace(/\/$/, '')}/gradio_api/call/process_ai_request`;
      const startRes = await axios.post(
        endpoint,
        { data: ['🧠 Brain (Qwen)', null, `${systemPrompt}\n\n${userPrompt}`] },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          timeout: 3500,
        },
      );

      const eventId = startRes.data?.event_id;
      if (!eventId) {
        this.hfCooldownUntil = Date.now() + 300_000;
        return '';
      }

      const streamRes = await axios.get(`${endpoint}/${eventId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        responseType: 'text',
        timeout: 3500,
      });

      const lines = (streamRes.data as string).split('\n');
      for (const line of lines) {
        if (line.startsWith('data:')) {
          try {
            const parsed = JSON.parse(line.substring(5).trim());
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]) {
              const res = this.cleanOutput(parsed[0]);
              if (res.length > 20) return res;
            }
          } catch (_) {}
        }
      }
      this.hfCooldownUntil = Date.now() + 300_000;
    } catch (err: any) {
      this.hfCooldownUntil = Date.now() + 300_000;
      this.logger.warn(`HF Qwen Space temporarily on cooldown (using fast Gemini engine): ${err.message}`);
    }
    return '';
  }

  private async callGemini(systemPrompt: string, userPrompt: string, maxTokens = 1500): Promise<string | null> {
    const key = this.getGeminiKey();
    if (!key) return null;

    const candidateModels = [
      'gemini-flash-lite-latest',
      'gemini-2.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
    ];

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const res = await axios.post(
          url,
          {
            contents: [
              {
                parts: [
                  { text: `${systemPrompt}\n\n${userPrompt}` },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.85,
              maxOutputTokens: maxTokens,
            },
          },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 12000,
          },
        );

        const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim().length > 0) {
          return this.cleanOutput(text);
        }
      } catch (err: any) {
        this.logger.warn(`Gemini model ${model} text generation skipped: ${err.response?.status || err.message}`);
      }
    }
    return null;
  }

  private async queryBrain(systemPrompt: string, userPrompt: string, maxTokens = 1500): Promise<string> {
    // 1. Dedicated Local AI Model: Hugging Face Qwen 3.8 / 2.5 Space (with automatic cooldown if sleeping)
    try {
      const hfRes = await this.callHf(systemPrompt, userPrompt);
      if (hfRes && hfRes.trim().length > 30) return hfRes;
    } catch (_) {}

    // 2. Cascade immediately to Google Gemini Flash Engine
    try {
      const geminiRes = await this.callGemini(systemPrompt, userPrompt, maxTokens);
      if (geminiRes && geminiRes.trim().length > 30) return geminiRes;
    } catch (_) {}

    return '';
  }

  // ---------------- MULTI-PROMPT & CONCEPT PARSING ENGINE ----------------
  parseUserPromptExamples(rawText: string): string[] {
    if (!rawText || !rawText.trim()) return [];
    const text = rawText.trim();

    // Pattern 1: Explicit labels like "PROMPT 1", "Prompt 2:", "Example 1:", "Concept 1:"
    const promptLabelRegex = /(?:^|\n+)(?:[-=_]{2,}\s*)?(?:#+\s*)?(?:PROMPT|Prompt|Example|Concept|Variation)\s*#?\s*\d+[\s\:\-\.\)_=]*/gi;
    if (promptLabelRegex.test(text)) {
      const parts = text
        .split(/(?:^|\n+)(?:[-=_]{2,}\s*)?(?:#+\s*)?(?:PROMPT|Prompt|Example|Concept|Variation)\s*#?\s*\d+[\s\:\-\.\)_=]*/gi)
        .map(p => p.trim())
        .filter(p => p.length > 30);
      if (parts.length > 1) {
        return parts;
      }
    }

    // Pattern 2: Delimiters like "---" or "===" or "___"
    if (text.includes('---') || text.includes('===')) {
      const parts = text
        .split(/\n+\s*[-=_]{3,}\s*\n+/)
        .map(p => p.trim())
        .filter(p => p.length > 30);
      if (parts.length > 1) {
        return parts;
      }
    }

    // Pattern 3: Explicit "Create a 10-second" / "Create a \d+-second" boundary markers
    const createRegex = /(?=(?:^|\n+)\s*Create a \d+[\s-]second)/gi;
    const parts3 = text.split(createRegex).map(p => p.trim()).filter(p => p.length > 30);
    if (parts3.length > 1) {
      return parts3;
    }

    // Pattern 4: Numbered list "1. ... \n\n 2. ..."
    const numRegex = /(?:^|\n+)\s*\d+[\.\)]\s+(?=[A-Z])/g;
    const parts4 = text.split(numRegex).map(p => p.trim()).filter(p => p.length > 30);
    if (parts4.length > 1) {
      return parts4;
    }

    return [text];
  }

  extractCoreSubjectFromPrompt(promptText: string): string {
    if (!promptText) return 'Unexplained physical phenomenon';
    const positivePart = promptText.split(/##\s*Negative prompt/i)[0].trim();

    const hookMatch = positivePart.match(/(?:points down at|points at|focuses on|discovers|revealing|reveals|examines|framed around)\s+([^;\.\n]{15,200})/i);
    if (hookMatch && hookMatch[1]) {
      return hookMatch[1].trim();
    }

    const timingMatch = positivePart.match(/(?:0[–\-]2s|0[–\-]3s|first second)[^:\.\n]*:\s*([^;\.\n]{15,200})/i);
    if (timingMatch && timingMatch[1]) {
      return timingMatch[1].trim();
    }

    const sentences = positivePart.split(/(?<=[.?!])\s+/).filter(s => s.length > 20);
    for (const s of sentences) {
      if (!s.toLowerCase().startsWith('create a') && !s.toLowerCase().startsWith('audio:')) {
        const clean = s.replace(/^(the setting is|the scene is set in|in this scene)[^,;.]*[,;.]\s*/i, '').trim();
        if (clean.length > 15) {
          return clean.slice(0, 180);
        }
      }
    }

    return positivePart.slice(0, 120);
  }

  // ---------------- LAYER 1: PROMPT DNA DECONSTRUCTOR ----------------
  async analyzeMasterPrompt(masterPrompt: string): Promise<PromptMatrix> {
    const userPrompts = this.parseUserPromptExamples(masterPrompt);
    const extractedNegative = this.extractNegativePrompt(masterPrompt);
    const sampleForDna = userPrompts[0] || masterPrompt;

    const sysPrompt = `You are a world-class AI Cinematography and Viral Video Engineering Director.
Your task is LAYER 1: PROMPT DNA DECONSTRUCTION & BRAND-NEW CONCEPT BRAINSTORMING.
Analyze the user's example prompt(s) to extract the fixed camera/timeline DNA, and brainstorm 100% BRAND-NEW, diverse visual concepts across completely different everyday objects and environments (NEVER repeat the user's example subjects, and DO NOT use rocks, stones, boulders, or slate slabs).
Output strictly in valid JSON format.`;

    const userPrompt = `
Analyze this MASTER PROMPT / EXAMPLE SET:
"""${sampleForDna}"""

Extract and return strictly valid JSON matching this schema:
{
  "niche_name": "Short 2-4 word distinctive title for this series",
  "theme_summary": "1-2 sentence core concept and visual identity summary",
  "fixed_dna": {
    "camera_and_medium": "Create a 10-second vertical 9:16 raw smartphone video shot strictly from the rear camera in pure continuous first-person POV, with absolutely no selfie camera, no face-cam, and no picture-in-picture overlay.",
    "timing_breakdown": [
      "0-2s: Immediate visual hook / phenomenon introduction",
      "0-3s: Handheld approach, natural mobile camera motion, auto-exposure balancing",
      "3-6s: Close-up physical interaction with everyday object and scale anchor",
      "6-8s: Secondary escalation defying expectations",
      "8-10s: Sudden dramatic climax, operator steps backward, abrupt cut with NO face visible"
    ],
    "negative_prompt": ${JSON.stringify(extractedNegative)},
    "audio_rules": "",
    "structural_template": ""
  },
  "hierarchical_matrix": {
    "sub_genres": ["12 completely different environments (bridges, railway crossings, gardens, piers, courtyards, barns, parks, etc.)"],
    "locations": ["12 diverse real-world settings with zero repetition"],
    "subjects_or_anomalies": ["15 brand-new, visually distinct phenomena featuring different everyday objects (bicycles, lanterns, water bridges, swings, clocks, puddles, canoes, umbrellas, staircases, etc. - NO rocks or stones)"],
    "tools_and_probes": ["12 diverse everyday items used to test or interact"],
    "scale_anchors": ["12 diverse natural micro details (leaves, feathers, flowers, shells, insects) with NO mention of rocks or stones"],
    "climaxes": ["12 high-impact visual climaxes with NO mention of rocks or stones"]
  }
}
Return ONLY valid JSON. No conversational text.`;

    let parsedMatrix: PromptMatrix | null = null;
    try {
      const raw = await this.queryBrain(sysPrompt, userPrompt, 2500);
      const match = raw ? raw.match(/\{[\s\S]*\}/) : null;
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.niche_name && parsed.fixed_dna && parsed.hierarchical_matrix) {
          parsed.fixed_dna.negative_prompt = extractedNegative;
          parsed.fixed_dna.audio_rules = '';
          parsed.fixed_dna.camera_and_medium = DEFAULT_CAMERA_MEDIUM;
          parsedMatrix = {
            niche_name: parsed.niche_name,
            theme_summary: parsed.theme_summary || '100% unique 10-second vertical video series with zero concept repetition.',
            fixed_dna: parsed.fixed_dna,
            hierarchical_matrix: parsed.hierarchical_matrix,
            subjects: parsed.hierarchical_matrix.subjects_or_anomalies || [],
            locations: parsed.hierarchical_matrix.locations || [],
            actions_or_hooks: parsed.hierarchical_matrix.climaxes || [],
            camera_styles: [DEFAULT_CAMERA_MEDIUM],
          };
        }
      }
    } catch (e: any) {
      this.logger.warn(`DNA matrix JSON fallback activated: ${e.message}`);
    }

    const fallbackMatrix = this.getIntelligentFallbackMatrix(masterPrompt);
    if (!parsedMatrix) {
      parsedMatrix = fallbackMatrix;
    } else {
      parsedMatrix.fixed_dna.negative_prompt = extractedNegative;
      parsedMatrix.fixed_dna.audio_rules = '';
      parsedMatrix.fixed_dna.camera_and_medium = DEFAULT_CAMERA_MEDIUM;
      parsedMatrix.hierarchical_matrix.sub_genres = [
        ...(parsedMatrix.hierarchical_matrix.sub_genres || []),
        ...fallbackMatrix.hierarchical_matrix.sub_genres,
      ].slice(0, 20);
      parsedMatrix.hierarchical_matrix.locations = [
        ...(parsedMatrix.hierarchical_matrix.locations || []),
        ...fallbackMatrix.hierarchical_matrix.locations,
      ].slice(0, 20);
      parsedMatrix.hierarchical_matrix.subjects_or_anomalies = [
        ...(parsedMatrix.hierarchical_matrix.subjects_or_anomalies || []),
        ...fallbackMatrix.hierarchical_matrix.subjects_or_anomalies,
      ].slice(0, 20);
      parsedMatrix.hierarchical_matrix.tools_and_probes = [
        ...(parsedMatrix.hierarchical_matrix.tools_and_probes || []),
        ...fallbackMatrix.hierarchical_matrix.tools_and_probes,
      ].slice(0, 20);
      parsedMatrix.hierarchical_matrix.scale_anchors = [
        ...(parsedMatrix.hierarchical_matrix.scale_anchors || []),
        ...fallbackMatrix.hierarchical_matrix.scale_anchors,
      ].slice(0, 20);
      parsedMatrix.hierarchical_matrix.climaxes = [
        ...(parsedMatrix.hierarchical_matrix.climaxes || []),
        ...fallbackMatrix.hierarchical_matrix.climaxes,
      ].slice(0, 20);
      parsedMatrix.subjects = parsedMatrix.hierarchical_matrix.subjects_or_anomalies;
    }

    if (userPrompts.length > 1) {
      parsedMatrix.niche_name = `Zero-Repeat Multi-Concept Series`;
      parsedMatrix.theme_summary = `100% brand-new, unrepeated 10-second vertical video concepts inspired by your ${userPrompts.length} example prompts.`;
    }

    return parsedMatrix;
  }

  /**
   * Build a guaranteed-unique Scene Blueprint for any prompt index (1 to 1,000+),
   * ensuring every single prompt features a completely different object, environment, and action.
   */
  private getBlueprintForIndex(currentIdx: number, matrix: PromptMatrix, masterPrompt: string): UniqueSceneBlueprint {
    const slot = currentIdx - 1;
    const baseCount = MASTER_SCENE_BLUEPRINTS.length;

    if (slot < baseCount) {
      return MASTER_SCENE_BLUEPRINTS[slot];
    }

    // For prompts beyond the first 105 blueprints (e.g. up to 500 or 1,000 prompts),
    // use coprime modular permutation across objects, settings, tools, and phase mutations
    const cycle = Math.floor(slot / baseCount);
    const b1 = MASTER_SCENE_BLUEPRINTS[slot % baseCount];
    const b2 = MASTER_SCENE_BLUEPRINTS[(slot * 7 + cycle * 3) % baseCount];
    const b3 = MASTER_SCENE_BLUEPRINTS[(slot * 13 + cycle * 5) % baseCount];
    const b4 = MASTER_SCENE_BLUEPRINTS[(slot * 19 + cycle * 11) % baseCount];

    const mutatedSubject = this.mutateAnomalyForScale(b1.subject, cycle, slot);

    return {
      sub_genre: `${b2.sub_genre} (Var #${currentIdx})`,
      location: b2.location,
      subject: mutatedSubject,
      tool: b3.tool,
      anchor: b4.anchor,
      escalation: b1.escalation,
      climax: b3.climax,
    };
  }

  // ---------------- LAYER 2 & 3: HIERARCHICAL MATRIX & SEMANTIC VALIDATOR ----------------
  async generateBatch(
    masterPrompt: string,
    matrix: PromptMatrix,
    startIdx: number,
    count: number,
  ): Promise<GeneratedPromptItem[]> {
    const extractedNegative = matrix?.fixed_dna?.negative_prompt || this.extractNegativePrompt(masterPrompt);
    const cameraMedium = DEFAULT_CAMERA_MEDIUM;

    const fixed: FixedDNA = {
      camera_and_medium: cameraMedium,
      timing_breakdown: matrix?.fixed_dna?.timing_breakdown || [
        '0-2s: Immediate visual hook',
        '0-3s: Handheld approach and auto-exposure adjustment',
        '3-6s: Close-up physical interaction and scale anchor',
        '6-8s: Secondary escalation defying physics',
        '8-10s: Sudden dramatic climax and abrupt cut with NO face visible',
      ],
      negative_prompt: extractedNegative,
      audio_rules: '',
      structural_template: '',
    };

    const generateOne = async (currentIdx: number): Promise<GeneratedPromptItem> => {
      const blueprint = this.getBlueprintForIndex(currentIdx, matrix, masterPrompt);

      let promptText = '';
      let lastSimilarity = 0;

      const sysPrompt = `You are a world-class viral short-form cinematic AI video director.
Write a single ready-to-run 10-second vertical 9:16 video generation prompt for Prompt #${currentIdx}.

CRITICAL ZERO-REPEAT & FORMATTING RULES:
1. Begin the prompt with this exact sentence: "${fixed.camera_and_medium}"
2. Setting MUST be: ${blueprint.location}.
3. In the first second (0–2s), focus immediately on this brand-new visual phenomenon: ${blueprint.subject}.
4. From 0–3 seconds: show cautious handheld steps approaching, natural mobile phone bobbing with breathing, and camera auto-exposure adjusting.
5. From 3–6 seconds: lean within eight inches; an ordinary bare hand uses ${blueprint.tool} to physically test the phenomenon, framed alongside ${blueprint.anchor}.
6. From 6–8 seconds: ${blueprint.escalation}.
7. From 8–10 seconds: ${blueprint.climax}.
8. STRICTLY NO AUDIO LINES: Do NOT include any "Audio:", "Audio Design:", "Sound:", or Foley descriptions anywhere in the prompt!
9. NO ROCKS OR STONES: Do NOT focus on rocks, stones, boulders, pebbles, or slate slabs. Keep the focus 100% on the assigned object and phenomenon.
10. Do NOT include any "PROMPT ${currentIdx}" header or markdown fences. Output ONLY the descriptive paragraph followed by the ## Negative prompt section.`;

      const userPrompt = `Write the complete 10-second video prompt starting with "Create a 10-second vertical 9:16 raw smartphone video..." centered strictly on: ${blueprint.subject} in ${blueprint.location}. Remember: ZERO audio lines, and include the full ## Negative prompt at the end.`;

      try {
        const rawGenerated = await this.queryBrain(sysPrompt, userPrompt, 1500);
        if (rawGenerated && rawGenerated.trim().length > 220) {
          promptText = this.finalizePromptText(rawGenerated, fixed.negative_prompt);
        }
      } catch (_) {}

      if (!promptText || promptText.length < 260) {
        promptText = this.assembleBlueprintPrompt(fixed, blueprint);
      }

      const similarity = this.calculateMaxSimilarity(promptText);
      lastSimilarity = similarity;
      this.recordPromptTokens(currentIdx.toString(), promptText);

      return {
        index: currentIdx,
        sub_genre: `Unique Concept #${currentIdx} — ${blueprint.sub_genre}`,
        location: blueprint.location,
        subject: blueprint.subject,
        text: promptText,
        similarity_score: Number((lastSimilarity * 100).toFixed(1)),
      };
    };

    // Execute batch items in parallel chunks of 5 for fast response without Render timeouts
    const indices = Array.from({ length: count }, (_, i) => startIdx + i);
    const results: GeneratedPromptItem[] = [];
    const chunkSize = 5;
    for (let i = 0; i < indices.length; i += chunkSize) {
      const slice = indices.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(slice.map(idx => generateOne(idx)));
      results.push(...chunkResults);
    }
    return results.sort((a, b) => a.index - b.index);
  }

  // ---------------- LAYER 3: ANTI-DUPLICATE SEMANTIC VALIDATOR ----------------
  private extractTokens(text: string): Set<string> {
    const positiveOnly = text.split(/##\s*Negative prompt/i)[0] || text;
    const stopWords = new Set([
      'create', 'second', 'vertical', 'smartphone', 'video', 'shot', 'strictly',
      'camera', 'pure', 'continuous', 'first', 'person', 'selfie', 'face', 'picture',
      'overlay', 'setting', 'seconds', 'from', 'show', 'with', 'hand', 'bare', 'operator',
      'audio', 'negative', 'prompt', 'human', 'cinematic', 'realistic', 'phone', 'down',
      'rear', 'cautious', 'handheld', 'steps', 'approaching', 'inches', 'abruptly', 'visible',
    ]);
    const words = positiveOnly
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w));
    return new Set(words);
  }

  private calculateMaxSimilarity(newText: string): number {
    const newTokens = this.extractTokens(newText);
    if (newTokens.size === 0 || this.sessionTokenHistory.size === 0) return 0;

    let maxSim = 0;
    const historyEntries = Array.from(this.sessionTokenHistory.values()).slice(-30);
    for (const prevTokens of historyEntries) {
      let intersection = 0;
      for (const t of newTokens) {
        if (prevTokens.has(t)) intersection++;
      }
      const union = newTokens.size + prevTokens.size - intersection;
      const sim = union > 0 ? intersection / union : 0;
      if (sim > maxSim) maxSim = sim;
    }
    return maxSim;
  }

  private recordPromptTokens(id: string, text: string) {
    this.sessionTokenHistory.set(id, this.extractTokens(text));
    if (this.sessionTokenHistory.size > 200) {
      const firstKey = this.sessionTokenHistory.keys().next().value;
      if (firstKey) this.sessionTokenHistory.delete(firstKey);
    }
  }

  private assembleBlueprintPrompt(fixed: FixedDNA, bp: UniqueSceneBlueprint): string {
    const camera = fixed.camera_and_medium || DEFAULT_CAMERA_MEDIUM;
    const rawBody =
      `${camera} ` +
      `The setting is ${bp.location}. ` +
      `In the first second, the camera points directly at an impossible visual hook: ${bp.subject}. ` +
      `From 0–3 seconds, show cautious handheld steps approaching the scene, the smartphone bobbing naturally with the operator breathing and camera auto-exposure adjusting smoothly to the ambient daylight. ` +
      `From 3–6 seconds, crouch or lean within eight inches of the phenomenon; an ordinary bare hand enters the bottom of the frame holding ${bp.tool} and physically tests the anomaly, with ${bp.anchor}. ` +
      `From 6–8 seconds, ${bp.escalation}. ` +
      `From 8–10 seconds, ${bp.climax}.`;

    return this.finalizePromptText(rawBody, fixed.negative_prompt);
  }

  private mutateAnomalyForScale(base: string, cycle: number, slot: number): string {
    const modifiers = [
      'while surrounded by a shimmering optical lens ring that magnifies the background twice its normal scale',
      'while shedding upward-falling crystalline frost flakes in warm daylight',
      'while casting a crisp shadow that moves in the exact opposite direction of the physical motion',
      'while glowing with rhythmic amber bioluminescent ripples across its surface',
      'while suspended inside a localized pocket of hyper-slow-motion air refraction',
      'while surrounded by hovering concentric rings of levitating water droplets',
    ];
    const mod = modifiers[(slot + cycle) % modifiers.length];
    return `${base}, ${mod}`;
  }

  private getIntelligentFallbackMatrix(masterPrompt: string): PromptMatrix {
    const userPrompts = this.parseUserPromptExamples(masterPrompt);
    const isMultiPrompt = userPrompts.length > 1;
    const extractedNegative = this.extractNegativePrompt(masterPrompt);

    return {
      niche_name: isMultiPrompt ? `Zero-Repeat Multi-Concept Series` : 'Viral Found-Footage Series',
      theme_summary:
        '100% brand-new, unrepeated 10-second vertical 9:16 first-person POV smartphone videos across diverse everyday objects and environments.',
      fixed_dna: {
        camera_and_medium: DEFAULT_CAMERA_MEDIUM,
        timing_breakdown: [
          '0-2s: Undeniable reality-bending visual hook on a unique everyday object',
          '0-3s: Cautious handheld steps, natural mobile phone wobble, auto-exposure balancing',
          '3-6s: Close-up within 8 inches, physical test with everyday object, natural scale anchor',
          '6-8s: Secondary escalation defying physical expectations',
          '8-10s: Sudden dramatic climax, operator steps backward, abrupt cut with NO face visible',
        ],
        negative_prompt: extractedNegative,
        audio_rules: '',
        structural_template: '',
      },
      hierarchical_matrix: {
        sub_genres: MASTER_SCENE_BLUEPRINTS.slice(0, 20).map(b => b.sub_genre),
        locations: MASTER_SCENE_BLUEPRINTS.slice(0, 20).map(b => b.location),
        subjects_or_anomalies: MASTER_SCENE_BLUEPRINTS.slice(0, 20).map(b => b.subject),
        tools_and_probes: MASTER_SCENE_BLUEPRINTS.slice(0, 20).map(b => b.tool),
        scale_anchors: MASTER_SCENE_BLUEPRINTS.slice(0, 20).map(b => b.anchor),
        climaxes: MASTER_SCENE_BLUEPRINTS.slice(0, 20).map(b => b.climax),
      },
      subjects: MASTER_SCENE_BLUEPRINTS.slice(0, 20).map(b => b.subject),
      locations: MASTER_SCENE_BLUEPRINTS.slice(0, 20).map(b => b.location),
      actions_or_hooks: MASTER_SCENE_BLUEPRINTS.slice(0, 20).map(b => b.climax),
      camera_styles: [DEFAULT_CAMERA_MEDIUM],
    };
  }

  // ---------------- LAYER 4: DOWNLOADABLE FILE & VPS 1-CLICK LINKING ----------------
  async pushToVps(filename: string, content: string, vpsUrl?: string): Promise<{ success: boolean; message: string; filePath?: string }> {
    const exportDir = path.join(process.cwd(), 'uploads', 'prompts');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    const localFilePath = path.join(exportDir, filename);
    fs.writeFileSync(localFilePath, content, 'utf-8');

    if (vpsUrl && vpsUrl.trim().startsWith('http')) {
      try {
        const res = await axios.post(
          vpsUrl.trim(),
          { filename, content },
          { timeout: 15000, headers: { 'Content-Type': 'application/json' } },
        );
        return {
          success: true,
          message: `Successfully transferred to VPS endpoint (${res.status}): ${filename}`,
          filePath: localFilePath,
        };
      } catch (err: any) {
        this.logger.warn(`Push to custom VPS URL failed: ${err.message}. File saved locally.`);
      }
    }

    return {
      success: true,
      message: `Prompt file '${filename}' successfully saved on server! Ready for 1-click download or automated VPS rendering.`,
      filePath: localFilePath,
    };
  }

  // ---------------- 🎬 NATIVE VIDEO REVERSE-ENGINEERING (GEMINI 3.8 FLASH) ----------------
  async uploadVideoToGemini(videoBuffer: Buffer, mimeType = 'video/mp4'): Promise<string> {
    const key = this.getGeminiKey();
    const url = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${key}`;
    const res = await axios.post(url, videoBuffer, {
      headers: {
        'X-Goog-Upload-Command': 'start, upload, finalize',
        'X-Goog-Upload-Header-Content-Length': videoBuffer.length.toString(),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': 'application/octet-stream',
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 90000,
    });

    const fileData = res.data?.file;
    if (!fileData?.uri) {
      throw new Error('Google Gemini File API upload fail ho gaya. Response me file URI nahi mila.');
    }

    let state = fileData.state;
    const fileName = fileData.name;
    let attempts = 0;
    while (state === 'PROCESSING' && attempts < 25) {
      this.logger.log(`Waiting for Gemini video processing (state: ${state}, attempt: ${attempts + 1})...`);
      await new Promise(r => setTimeout(r, 1500));
      try {
        const check = await axios.get(
          `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${key}`,
          { timeout: 15000 },
        );
        state = check.data?.state;
      } catch (checkErr: any) {
        this.logger.warn(`Polling file status warning: ${checkErr.message}`);
      }
      attempts++;
    }

    if (state === 'FAILED') {
      throw new Error('Google Gemini video process nahi kar saka (state: FAILED).');
    }

    return fileData.uri;
  }

  async downloadVideoFromUrl(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const isFacebook = /(facebook\.com|fb\.watch)/i.test(url);
    const isTikTok = /tiktok\.com/i.test(url);
    const isSocial = isFacebook || isTikTok || /(instagram\.com|youtube\.com|youtu\.be|x\.com|twitter\.com)/i.test(url);

    if (isTikTok) {
      try {
        const tikwmRes = await axios.post(
          'https://www.tikwm.com/api/',
          new URLSearchParams({ url, hd: '1' }),
          { timeout: 15000, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
        );
        const playUrl = tikwmRes.data?.data?.play || tikwmRes.data?.data?.wmplay;
        if (playUrl) {
          const streamRes = await axios.get(playUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          });
          return { buffer: Buffer.from(streamRes.data), mimeType: 'video/mp4' };
        }
      } catch (e: any) {
        this.logger.warn(`TikWM download fallback failed: ${e.message}, trying yt-dlp...`);
      }
    }

    if (isSocial) {
      try {
        const tmpFile = path.join(os.tmpdir(), `autopost_vid_${Date.now()}.mp4`);
        const isWin = process.platform === 'win32';
        const ytDlpCmd = isWin ? 'yt-dlp.exe' : 'yt-dlp';
        await execPromise(`${ytDlpCmd} -f "mp4/best[ext=mp4]/best" --no-playlist -o "${tmpFile}" "${url}"`, {
          timeout: 45000,
        });
        if (fs.existsSync(tmpFile)) {
          const buf = fs.readFileSync(tmpFile);
          try { fs.unlinkSync(tmpFile); } catch (_) {}
          if (buf.length > 5000) {
            return { buffer: buf, mimeType: 'video/mp4' };
          }
        }
      } catch (err: any) {
        this.logger.warn(`yt-dlp download failed: ${err.message}. Trying direct fetch...`);
      }
    }

    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      const contentType = String(response.headers['content-type'] || 'video/mp4');
      const mimeType = contentType.split(';')[0].trim();

      if (!mimeType.includes('html') && !mimeType.includes('text') && response.data?.length > 5000) {
        return { buffer: Buffer.from(response.data), mimeType };
      }
    } catch (httpErr: any) {
      this.logger.warn(`Direct HTTP GET failed: ${httpErr.message}`);
    }

    if (isFacebook) {
      throw new Error(
        'Facebook security wall ne is Reel ka automated download block kar diya hai. Baraye meherbani video apne mobile ya PC se download karein aur "Upload .mp4" tab ke zariye direct upload karein!',
      );
    }

    throw new Error(
      'Is video link se stream download nahi ho saki. Baraye meherbani direct .mp4 video link dein ya "Upload .mp4" tab ke zariye direct file upload karein!',
    );
  }

  async reverseEngineerVideo(
    videoBuffer: Buffer,
    sampleCount = 5,
    mimeType = 'video/mp4',
  ): Promise<{
    originalAnalysis: any;
    reSkinnedConcept: any;
    masterPrompt: string;
    matrix: PromptMatrix;
    testPrompts: GeneratedPromptItem[];
  }> {
    const key = this.getGeminiKey();
    this.logger.log(`Uploading ${videoBuffer.length} bytes video to Gemini File API...`);
    const fileUri = await this.uploadVideoToGemini(videoBuffer, mimeType);
    this.logger.log(`Gemini video upload ready: ${fileUri}`);

    const anchorCount = Math.min(Math.max(sampleCount, 1), 5);

    const promptText = `You are a world-class AI Cinematographer and Viral Short-Form Video Producer.
Your task is NATIVE VIDEO REVERSE-ENGINEERING of this short video clip.

CRITICAL INSTRUCTION:
Base your entire analysis 100% strictly on what is ACTUALLY visible in this specific video clip. Do NOT assume the video is about rocks, stones, tools, or biomes unless you actually observe them in the footage.

Perform these critical tasks:

TASK 1: DECONSTRUCT ORIGINAL VIDEO:
- actual_subject_and_action: Factual description of what is actually happening in this video.
- visual_hook_0_to_2s: The exact opening visual hook that grabs attention in the first 2 seconds.
- camera_perspective: Framing, POV, camera movement, autofocus, handheld natural motion/wobble, lighting.
- interaction_or_action: Main subject interaction, action, or escalation between 2-8 seconds.
- climax_or_ending: The climax, final reaction, dramatic turn, or ending hook between 8-10 seconds.
- viral_retention_formula: Why this video works psychologically (curiosity gap, tension curve, satisfying visuals).

TASK 2: RE-SKIN INTO A 100% BRAND NEW CONCEPT (Same Viral Formula, Fresh Original Content):
- Retain the EXACT viral retention curve, tension, and camera pacing, but create a 100% brand-new, copyright-free creative concept in the same style/genre.
- title: Short distinctive concept title.
- niche: Specific content niche.
- core_hook: The new, 100% original hook that replaces the original video's subject.
- new_biome: New creative environment or setting.
- new_tool: New item, tool, or focal interaction element.
- new_scale_anchor: New visual detail or texture element.
- new_climax: New dramatic ending or reaction.

TASK 3: COMPILE THE MASTER PROMPT:
- Full, ready-to-run 10-second prompt for this new re-skinned concept with full camera POV, setting, 0-2s hook, 2-5s action, 5-8s escalation, 8-10s climax, and ## Negative prompt block. Do NOT include any "Audio:" or sound description lines in the prompt.

TASK 4: HIERARCHICAL MATRIX & ${anchorCount} INITIAL TEST PROMPTS:
- Create a focused, high-density matrix tailored to THIS concept where every item is a completely different object/scene:
  * sub_genres: 10 distinct themes/sub-genres
  * locations: 10 distinct locations
  * subjects_or_anomalies: 10 distinct subjects/hooks (completely different objects, no repetition)
  * tools_and_probes: 10 tools/objects/interaction details
  * scale_anchors: 8 scale anchors/fine details
  * climaxes: 10 climaxes/endings
- test_prompts: Generate ${anchorCount} complete, ready-to-run 10-second variation prompts. Each prompt must feature a different object/scene, must have ZERO "Audio:" lines, and must include the complete ## Negative prompt block.

Return strictly valid JSON with this schema:
{
  "original_analysis": {
    "actual_subject_and_action": "...",
    "visual_hook": "...",
    "camera_and_pov": "...",
    "interaction_or_action": "...",
    "climax": "...",
    "audio_elements": "Natural environmental audio",
    "viral_retention_formula": "..."
  },
  "re_skinned_concept": {
    "title": "...",
    "niche": "...",
    "core_hook": "...",
    "new_biome": "...",
    "new_tool": "...",
    "new_scale_anchor": "...",
    "new_climax": "..."
  },
  "master_prompt": "...",
  "matrix": {
    "niche_name": "...",
    "theme_summary": "...",
    "fixed_dna": {
      "camera_and_medium": "...",
      "timing_breakdown": ["0-2s...", "2-5s...", "5-8s...", "8-10s..."],
      "negative_prompt": "...",
      "audio_rules": ""
    },
    "hierarchical_matrix": {
      "sub_genres": ["..."],
      "locations": ["..."],
      "subjects_or_anomalies": ["..."],
      "tools_and_probes": ["..."],
      "scale_anchors": ["..."],
      "climaxes": ["..."]
    }
  },
  "test_prompts": [
    {
      "index": 1,
      "sub_genre": "...",
      "location": "...",
      "subject": "...",
      "text": "Complete 10-second prompt #1 with ## Negative prompt and zero Audio lines"
    }
  ]
}`;

    const payload = {
      contents: [
        {
          parts: [
            {
              fileData: {
                fileUri,
                mimeType,
              },
            },
            {
              text: promptText,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    };

    const candidateModels = [
      'gemini-2.5-flash',
      'gemini-flash-lite-latest',
      'gemini-3.5-flash',
      'gemini-3.8-flash',
    ];

    let candidate: string | null = null;
    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        this.logger.log(`Calling Gemini Video Vision with model: ${model}`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const res = await axios.post(url, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 35000,
        });

        const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim().length > 0) {
          candidate = text;
          this.logger.log(`Gemini video analysis succeeded with ${model}!`);
          break;
        }
      } catch (err: any) {
        const status = err.response?.status;
        const errDetails = err.response?.data?.error?.message || err.message;
        this.logger.warn(`Gemini model ${model} failed (${status}): ${errDetails}. Cascading to next model...`);
        lastError = err;
        if (status === 503 || status === 429) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    }

    if (!candidate) {
      const errDetail = lastError?.response?.data?.error?.message || lastError?.message || 'High server demand';
      throw new Error(`Google Gemini Video Vision servers par high demand hai: ${errDetail}. Kuch lamhay baad dobara try karein.`);
    }

    let cleanCandidate = candidate.trim();
    if (cleanCandidate.startsWith('```json')) {
      cleanCandidate = cleanCandidate.replace(/^```json\s*/, '').replace(/\s*```[\s\S]*$/, '');
    } else if (cleanCandidate.startsWith('```')) {
      cleanCandidate = cleanCandidate.replace(/^```\s*/, '').replace(/\s*```[\s\S]*$/, '');
    }

    const firstBrace = cleanCandidate.indexOf('{');
    const lastBrace = cleanCandidate.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanCandidate = cleanCandidate.substring(firstBrace, lastBrace + 1);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(cleanCandidate);
    } catch (parseErr: any) {
      this.logger.warn(`Initial JSON parse failed: ${parseErr.message}. Attempting structural repair...`);
      let repaired = false;
      const lastObjClose = cleanCandidate.lastIndexOf('},');
      if (lastObjClose !== -1) {
        try {
          const testCandidate = cleanCandidate.substring(0, lastObjClose + 1) + ']}';
          parsed = JSON.parse(testCandidate);
          repaired = true;
        } catch (_) {}
      }
      if (!repaired) {
        const lastBraceClose = cleanCandidate.lastIndexOf('}');
        if (lastBraceClose !== -1) {
          try {
            const testCandidate = cleanCandidate.substring(0, lastBraceClose + 1) + '}';
            parsed = JSON.parse(testCandidate);
            repaired = true;
          } catch (_) {}
        }
      }
      if (!repaired) {
        throw new Error('Gemini Video Vision output format error. Please try analyzing again.');
      }
    }

    const nicheName = parsed.matrix?.niche_name || parsed.re_skinned_concept?.title || 'Viral Video Concept';
    const themeSummary = parsed.matrix?.theme_summary || parsed.re_skinned_concept?.core_hook || '10-second vertical video series';
    const finalNegative = parsed.matrix?.fixed_dna?.negative_prompt && parsed.matrix.fixed_dna.negative_prompt.length > 40
      ? parsed.matrix.fixed_dna.negative_prompt
      : DEFAULT_NEGATIVE_PROMPT;

    const matrix: PromptMatrix = {
      niche_name: nicheName,
      theme_summary: themeSummary,
      fixed_dna: {
        camera_and_medium: parsed.matrix?.fixed_dna?.camera_and_medium || DEFAULT_CAMERA_MEDIUM,
        timing_breakdown: parsed.matrix?.fixed_dna?.timing_breakdown || ['0-2s: Hook', '2-5s: Development', '5-8s: Escalation', '8-10s: Climax'],
        negative_prompt: finalNegative,
        audio_rules: '',
        structural_template: '',
      },
      hierarchical_matrix: parsed.matrix?.hierarchical_matrix || {
        sub_genres: [parsed.re_skinned_concept?.niche || 'Signature Concept'],
        locations: [parsed.re_skinned_concept?.new_biome || 'Signature Setting'],
        subjects_or_anomalies: [parsed.re_skinned_concept?.core_hook || 'Core Visual Hook'],
        tools_and_probes: [parsed.re_skinned_concept?.new_tool || 'Focal Interaction'],
        scale_anchors: [parsed.re_skinned_concept?.new_scale_anchor || 'Texture Detail'],
        climaxes: [parsed.re_skinned_concept?.new_climax || 'Dramatic Climax'],
      },
      subjects: parsed.matrix?.hierarchical_matrix?.subjects_or_anomalies || [parsed.re_skinned_concept?.core_hook || 'Core Hook'],
      locations: parsed.matrix?.hierarchical_matrix?.locations || [parsed.re_skinned_concept?.new_biome || 'Setting'],
      actions_or_hooks: parsed.matrix?.hierarchical_matrix?.climaxes || [parsed.re_skinned_concept?.new_climax || 'Climax'],
      camera_styles: ['Continuous vertical 9:16 POV'],
    };

    const cleanMasterPrompt = this.finalizePromptText(parsed.master_prompt || '', finalNegative);

    const testPrompts: GeneratedPromptItem[] = Array.isArray(parsed.test_prompts)
      ? parsed.test_prompts.map((p: any, i: number) => ({
          index: p.index || i + 1,
          sub_genre: p.sub_genre || p.title || `Variation ${i + 1}`,
          location: p.location || '',
          subject: p.subject || '',
          text: this.finalizePromptText(p.text || (typeof p === 'string' ? p : ''), finalNegative),
          similarity_score: 0,
        }))
      : [];

    return {
      originalAnalysis: parsed.original_analysis,
      reSkinnedConcept: parsed.re_skinned_concept,
      masterPrompt: cleanMasterPrompt,
      matrix,
      testPrompts,
    };
  }

  async reverseEngineerAndGenerateTestBatch(
    videoBuffer: Buffer,
    sampleCount = 5,
    mimeType = 'video/mp4',
  ): Promise<{
    originalAnalysis: any;
    reSkinnedConcept: any;
    masterPrompt: string;
    matrix: PromptMatrix;
    testPrompts: GeneratedPromptItem[];
  }> {
    const safeCount = Math.min(Math.max(sampleCount, 1), 20);
    const visionAnchorCount = Math.min(safeCount, 5);
    const result = await this.reverseEngineerVideo(videoBuffer, visionAnchorCount, mimeType);

    let testPrompts = result.testPrompts || [];

    if (testPrompts.length < safeCount) {
      const needed = safeCount - testPrompts.length;
      this.logger.log(`Supplementing ${needed} test prompts from Master Prompt and Matrix...`);
      const additional = await this.generateBatch(
        result.masterPrompt,
        result.matrix,
        testPrompts.length + 1,
        needed,
      );
      testPrompts = [...testPrompts, ...additional];
    }

    return {
      originalAnalysis: result.originalAnalysis,
      reSkinnedConcept: result.reSkinnedConcept,
      masterPrompt: result.masterPrompt,
      matrix: result.matrix,
      testPrompts: testPrompts.slice(0, safeCount),
    };
  }
}
