import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export class TextFileTools implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Text File Tools',
		name: 'textFileTools',
		group: ['transform'],
		version: 1,
		description: 'Process text-based files: remove UTF-8 BOM, convert line endings, skip lines',
		defaults: {
			name: 'Text File Tools',
		},
		icon: 'fa:file-alt',
		iconColor: 'purple',
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Binary Property Name',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				description: 'The name of the binary property containing the text file',
			},
			{
				displayName: 'Strip UTF-8 BOM',
				name: 'stripBOM',
				type: 'boolean',
				default: false,
				description: 'Whether to remove the UTF-8 Byte Order Mark (BOM) if present in the file',
			},
			{
				displayName: 'Convert Line Endings',
				name: 'convertLineEndingsEnabled',
				type: 'boolean',
				default: false,
				description: 'Whether to enable conversion of line endings between LF and CRLF',
			},
			{
				displayName: 'Line Ending Conversion',
				name: 'convertLineEndings',
				type: 'options',
				displayOptions: {
					show: {
						convertLineEndingsEnabled: [true],
					},
				},
				options: [
					{ name: 'LF to CRLF (Unix → Windows)', value: 'lfToCrlf' },
					{ name: 'CRLF to LF (Windows → Unix)', value: 'crlfToLf' },
				],
				default: 'lfToCrlf',
				description: 'Choose how to convert line endings. Default varies by OS.',
			},
			{
				displayName: 'Skip First N Lines',
				name: 'skipLinesEnabled',
				type: 'boolean',
				default: false,
				description: 'Whether to enable skipping the first N lines of the text file',
			},
			{
				displayName: 'Number of Lines to Skip',
				name: 'skipLinesCount',
				type: 'number',
				displayOptions: {
					show: {
						skipLinesEnabled: [true],
					},
				},
				typeOptions: {
					minValue: 1,
				},
				default: 1,
				description: 'Specify the number of lines to skip from the start of the file',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
				const stripBOM = this.getNodeParameter('stripBOM', i) as boolean;
				const convertLineEndingsEnabled = this.getNodeParameter(
					'convertLineEndingsEnabled',
					i,
				) as boolean;
				const skipLinesEnabled = this.getNodeParameter('skipLinesEnabled', i) as boolean;
				const binaryData = items[i].binary?.[binaryPropertyName];

				if (!binaryData) {
					throw new NodeOperationError(
						this.getNode(),
						`No binary data found for property "${binaryPropertyName}"`,
					);
				}

				let fileContent = Buffer.from(binaryData.data, 'base64').toString('utf8');

				// Remove UTF-8 BOM if present
				if (stripBOM && fileContent.startsWith('\uFEFF')) {
					fileContent = fileContent.slice(1);
				}

				// Convert line endings if enabled
				if (convertLineEndingsEnabled) {
					const convertLineEndings = this.getNodeParameter('convertLineEndings', i) as string;
					if (convertLineEndings === 'lfToCrlf') {
						fileContent = fileContent.replace(/\n/g, '\r\n');
					} else if (convertLineEndings === 'crlfToLf') {
						fileContent = fileContent.replace(/\r\n/g, '\n');
					}
				}

				// Skip first N lines if enabled
				if (skipLinesEnabled) {
					const skipLinesCount = this.getNodeParameter('skipLinesCount', i, 0) as number;

					if (skipLinesCount > 0) {
						const lines = fileContent.split(/\r?\n/); // Handle both LF and CRLF cases
						fileContent = lines.slice(skipLinesCount).join('\n'); // Preserve Unix-style LF for consistency
					}
				}

				// Convert back to binary
				const processedBuffer = Buffer.from(fileContent, 'utf8');
				const processedBinaryData = {
					...binaryData,
					data: processedBuffer.toString('base64'),
				};

				returnData.push({
					json: {},
					binary: {
						[binaryPropertyName]: processedBinaryData,
					},
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: {}, error, pairedItem: i });
				} else {
					throw new NodeOperationError(this.getNode(), error, { itemIndex: i });
				}
			}
		}

		return [returnData];
	}
}
