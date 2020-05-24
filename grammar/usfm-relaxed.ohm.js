exports.contents = 'usfmRelaxed{\n	File = BookHead Chapter+\n	BookHead = idMarker (MilesstoneMarker | ClosedMarker | NormalMarker)*\n	Chapter = ChapterMarker (VerseMarker | MilesstoneMarker | ClosedMarker | NormalMarker )+\n	verseNumber = number letter? ("-" number letter?)? \n	markerName = ~(cTag) ~(vTag) "+"? (letter | digit | "_")+ number?\n    attributes = "|" (~(backSlash) any)*\n	backSlash = "\\\\"\n	newLine = ("\\r" | "\\n")+\n	spaceChar = " "\n	char = ~(backSlash) ~(newLine) ~spaceChar ~("|") any\n	number = digit+\n	word = spaceChar* char+ spaceChar*\n	text =  newLine? word+\n	cTag = "c" spaceChar\n	vTag = "v" spaceChar\n	idMarker = newLine? backSlash "id" spaceChar word text?\n	ChapterMarker = newLine? backSlash cTag number\n	VerseMarker = newLine? backSlash vTag verseNumber  (text | MilesstoneMarker | ClosedMarker | NormalMarker)*\n	ClosedMarker = backSlash markerName (text | ClosedMarker)* attributes? backSlash markerName "*"\n	NormalMarker = backSlash markerName ( text  | ClosedMarker )* \n	MilesstoneMarker = MilesstoneMarkerSingle | MilesstoneMarkerPair\n	MilesstoneMarkerSingle = backSlash markerName backSlash "*"\n	MilesstoneMarkerPair = backSlash markerName "-" ("s"|"e") attributes? (backSlash "*")?\n}'