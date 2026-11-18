import { openSession, PcvModuleId } from '@nx.js/clkrst';

const session = openSession(PcvModuleId.CpuBus);
const originalClockRate = session.getClockRate();
const { rates } = session.getPossibleClockRates();
session.setClockRate(rates[rates.length - 1]);
addEventListener('unload', () => {
	session.setClockRate(originalClockRate);
});

import { render } from 'react-tela/render';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { AppletType } from '@nx.js/constants';
import { prodKeys } from './prod-keys';
import { loadSettings } from './settings';
import { shouldShowWalkthrough } from './accessibility';

// Routes
import { ErrorAppletMode } from './routes/ErrorAppletMode';
import { ErrorMissingProdKeys } from './routes/ErrorMissingProdKeys';
import { Generate } from './routes/Generate';
import { Select } from './routes/Select';
import { SelectForwarderType } from './routes/SelectForwarderType';
import { SelectRetroArch } from './routes/SelectRetroArch';
import { Success } from './routes/Success';
import { RouteErrorBoundary } from './routes/Error';
import { Batch } from './routes/Batch';
import { Edit } from './routes/Edit';
import { SettingsScreen } from './routes/Settings';
import { Walkthrough } from './routes/Walkthrough';
import { UsbSdAccess } from './routes/UsbSdAccess';
import { USB_SD_ACCESS_EXPLANATION_ENABLED } from './usb-sd-access/support';

const routes = [
	{
		path: '/error-applet-mode',
		element: <ErrorAppletMode />,
		errorElement: <RouteErrorBoundary />,
	},
	{
		path: '/error-missing-prod-keys',
		element: <ErrorMissingProdKeys />,
		errorElement: <RouteErrorBoundary />,
	},
	{
		path: '/select',
		element: <Select />,
		errorElement: <RouteErrorBoundary />,
	},
	{
		path: '/select-forwarder-type',
		element: <SelectForwarderType />,
		errorElement: <RouteErrorBoundary />,
	},
	{
		path: '/select-retroarch',
		element: <SelectRetroArch />,
		errorElement: <RouteErrorBoundary />,
	},
	{
		path: '/edit',
		element: <Edit />,
		errorElement: <RouteErrorBoundary />,
	},
	{
		path: '/settings',
		element: <SettingsScreen />,
		errorElement: <RouteErrorBoundary />,
	},
	{
		path: '/walkthrough',
		element: <Walkthrough />,
		errorElement: <RouteErrorBoundary />,
	},
	// Issue #10: explanation-only screen behind its feature flag. No USB
	// session, no SD access — see docs/usb-sd-access.md.
	...(USB_SD_ACCESS_EXPLANATION_ENABLED
		? [
				{
					path: '/usb-sd-access',
					element: <UsbSdAccess />,
					errorElement: <RouteErrorBoundary />,
				},
			]
		: []),
	{
		path: '/batch',
		element: <Batch />,
		errorElement: <RouteErrorBoundary />,
	},
	{
		path: '/generate',
		element: <Generate />,
		errorElement: <RouteErrorBoundary />,
	},
	{
		path: '/success',
		element: <Success />,
		errorElement: <RouteErrorBoundary />,
	},
];

let initialRoute = '/select';
if (Switch.appletType() !== AppletType.Application) {
	// Ensure the app is running in full-memory mode
	initialRoute = '/error-applet-mode';
} else if (!prodKeys) {
	// Ensure the `prod.keys` file exists
	initialRoute = '/error-missing-prod-keys';
} else if (
	shouldShowWalkthrough(
		loadSettings({
			readFile: (path) => Switch.readFileSync(path),
			writeFile: (path, data) => Switch.writeFileSync(path, data),
		}).preferences,
	)
) {
	// First run: tour the controller-first workflow before the library
	initialRoute = '/walkthrough';
}

const router = createMemoryRouter(routes, {
	initialEntries: [initialRoute],
	initialIndex: 0,
});

// Enable high-quality image smoothing for the canvas
const ctx = screen.getContext('2d');
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';

render(<RouterProvider router={router} />, screen);
