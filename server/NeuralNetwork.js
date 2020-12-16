const math = require('mathjs');
const fs = require('file-system');

class NeuralNetwork {
	constructor(layers=[]) {
		this.layers = layers;
	}

	save(path) { //сохранение слоев
		fs.writeFileSync(path, JSON.stringify(this.layers));
	}

	load(path) { //загрузка слоев
		const layers = JSON.parse(fs.readFileSync(path));
		this.layers = layers;
	}

	clear() {
		this.layers = [];
	}

}
class Layer {
	constructor(cnt,bias=0) {
		this.cnt = cnt;
		this.weights = [];
		this.activates = [];
		this.bias = bias;
	}

	init(length, func) {
		for (let i=0;i<this.cnt;i++) {
			const w = this.weights[i] = [];
			for (let j=0;j<length;j++) {
				w.push(func());
			}
		}
	}
}
class OutputLayer extends Layer {
	constructor(cnt, weights, activates, bias) {
		super(cnt,weights,activates,bias);
	}
}

class NeuralNetwork_BackProp extends NeuralNetwork {

	init({ input_cnt, output_cnt, hidden_cnt, hidden_neurons_cnt }) { //начальная инициализация
		const layers = this.layers;
		const defineWeight = _ => {
			return Math.random() - 0.5;
		};
		for (let i=0;i<hidden_cnt;i++) {
			const lay = new Layer(hidden_neurons_cnt, defineWeight);
			lay.init(input_cnt);
			layers.push(lay);
			input_cnt = lay.cnt;
		}

		const lay = new OutputLayer(output_cnt);
		lay.init(layers[layers.length - 1].cnt, defineWeight);
		layers.push(lay);
	}

	run(inputs) { //определение результата

		const calcActivate = (inputs,lay) => { //рассчет активации нейронов в слое
			const activates = [];
			const { cnt, weights, bias } = lay; //количество нейронов в слое; веса; биас

			for (let i=0; i<cnt; i++) {
				//const net = math.multiply(inputs,weights[i]) + bias[i];
				const net = math.multiply(inputs,weights[i]) + bias; //умножение инпутов и весов + биас
				const x = 1/(1+math.exp(-net)); //функция активации (сигмоида)
				activates.push(x);
			}

			return activates;
		};

		const layers = this.layers;
		let outputs = [];
		layers.forEach( (lay) => {
			inputs = calcActivate(inputs,lay);
			lay.activates = inputs;
		});
		outputs = inputs;

		return outputs;
	}

	train({ data, err=0.01, speed }) { //тренировка сети
		const chart = [ //график зависимости итераций от ошибки для google charts
			['Итерация', 'Ошибка']
		];

		let error;
		let cnt = 0;
		do {
			const errors = [];
			data.forEach(val => {
				const errorInSet = this._backProp(val.inputs,val.outputs,speed);
				errors.push(errorInSet);
			});

			error = errors.reduce((sum, a) => sum+a, 0) / errors.length;
			cnt += 1;

			chart.push([
				cnt,
				error
			])

			if (cnt > 5000) break;
		}
		while (err < error);

		return [cnt, chart];
	}

	_backProp(inputs, outputs, speed) { //back propagation
		const train_outputs = this.run(inputs);	
		const errors = [];
		errors.push(math.add(outputs,math.multiply(train_outputs,-1))); //ошибка в последнем слое
		const error = (math.square(errors[0])).reduce((sum, a) => sum+a, 0); //вычисление ошибки для формирования количества циклов

		const layers = this.layers; //слои сети

		layers.reverse().forEach((lay,index,arr) => {
			if (index === arr.length-1) return;
			let d = [];
			let weights_to_d = [];
			//let bias_to_d = [];
			let cnt = lay.weights[0].length;
			let ix = 0;
			for(let i=0;i<cnt;i++) {
				for(let j=0;j<lay.cnt;j++) {
					weights_to_d.push(lay.weights[j][ix]);
					//bias_to_d.push(lay.bias[j]);
				}
				ix++;
				//let dx = math.multiply(errors[0],math.add(weights_to_d,bias_to_d));
				let dx = math.multiply(errors[0],weights_to_d);
				d.push(dx);
				weights_to_d = [];
				//bias_to_d = [];
			}
			errors.unshift(d);
		});

		layers.reverse().forEach((lay,index) => {
			let weights = [];
			for(let i=0;i<lay.cnt;i++) {
				let weights_x = [];
				//let bias_x = [];
				for(let j=0;j<lay.weights[i].length;j++) {
					let w = lay.weights[i][j];
					//let b = lay.bias[j];
					let f = lay.activates[i]*(1-lay.activates[i]);
					weights_x.push(w+errors[index][i]*f*inputs[j]*speed);
					//bias_x.push(b+errors[index][i]*f*inputs[j]*speed);
				}
				weights.push(weights_x);
				//lay.bias = bias_x;
			}
			lay.weights = weights;
			inputs = lay.activates;
		});

		return error;
	}
}

class NeuralNetwork_CounterProp extends NeuralNetwork {

	init({ input_cnt, output_cnt, hidden_neurons_cnt }) { //начальная инициализация
		const layers = this.layers;
		const defineWeight = _ => {
			return Math.random();
		};

		const cohonen = new Layer(hidden_neurons_cnt);
		cohonen.init(input_cnt, defineWeight);
		layers.push(cohonen);

		const grossberg = new OutputLayer(output_cnt);
		grossberg.init(layers[layers.length - 1].cnt, defineWeight);
		layers.push(grossberg);
	}

	#calcActivates(inputs, lay) {
		const activates = [];
		const { cnt, weights, bias } = lay;

		for (let i=0;i<cnt;i++) {
			const net = math.multiply(inputs,weights[i]) + bias; //умножение инпутов и весов + биас
			activates.push(net); //запись в нейроны
		}

		if (lay.constructor.name === 'OutputLayer') {
			return activates;
		}

		const index = activates.indexOf(Math.max(...activates)); //индекс максимального
		return activates.map( (value, i) => {
			return (i === index) ? 1 : 0; //если индекс максимальный то 1, если нет 0
		});
	}

	#normalize(inputs) {
		return inputs.map( (x) => x/inputs.length);
	}

	run(inputs) { //определение результата
		let outputs = [];
		this.layers.forEach( (lay) => {
			lay.activates = this.#calcActivates(inputs,lay);
			inputs = lay.activates;
		});
		outputs = inputs;

		return outputs;
	}

	_counterProp(inputs, outputs, speedA=0.14, speedB=0.01, layers=this.layers) {

		const grossbergWeights = []; //для составления графиков
		const weightBack = {
			grossberg: null, cohonen: null
		};

		inputs = this.#normalize(inputs); //нормализованный вектор
		layers.forEach( (lay) => {
			if (lay.constructor.name === 'OutputLayer') { //cлой Гроссберга
				
				const index = inputs.indexOf(Math.max(...inputs)); //индекс выигравшего нейрона слоя Кохонена
				const weights = lay.weights; //массив всех весов слоя

				for (let i=0; i<lay.cnt; i++) {
					const weight = weights[i][index]; //значение старого веса соединенного с выигравшем нейроном слоя Кохонена
					const newWeight = weight+speedB*(outputs[i]-weight); //новый вес
					weights[i][index] = newWeight;

					grossbergWeights.push(weight);
				}

				weightBack.grossberg = grossbergWeights.reduce((sum,a) => sum+a, 0) / grossbergWeights.length;

				return;
			}

			const activates = this.#calcActivates(inputs,lay); //рассчет активаций
			const index = activates.indexOf(Math.max(...activates)); //индекс выигравшего нейрона слоя Кохонена
			const weightsCohonen = lay.weights; //все веса слоя Кохонена (для графика)
			let weights = weightsCohonen[index]; //веса соединенные с выигравшим нейроном слоя Кохонена

			weights = weights.map((weight,i) => weight+speedA*(inputs[i]-weight) ); //рассчитываем новые веса
			lay.weights[index] = weights;
			
			inputs = activates;

			weightBack.cohonen = weightsCohonen.reduce((reducer, a) => {
				return reducer + a.reduce( (sum,b) => sum+b) / a.length;
			}, 0) / weightsCohonen.length;
		});

		return [weightBack.grossberg, weightBack.cohonen];
	}

	train({ data, iteration=300, speedA=0.14, speedB=0.1}) {
		const chartItems = {
			grossbergWeights: [],
			cohonenWeights: [],
			inputs: [],
			outputs: []
		};

		const chart = [ //график для использования в google charts
			{name: 'Выходы и веса Гроссберга', data: [
				["Итерация","Средний вес Гроссберга","Средний выход"]
			]},
			{name: 'Входы и веса Кохонена', data: [
				["Итерация","Средний вес Кохонена","Средний вход"]
			]},
		];

		for(let i=0; i<iteration; i++) {
			data.forEach( (item) => {
				const {inputs, outputs} = item;

				const [grossbergWeight, cohonenWeight] = this._counterProp(inputs,outputs,speedA,speedB);

				chartItems.grossbergWeights.push(grossbergWeight);
				chartItems.cohonenWeights.push(cohonenWeight);
				chartItems.outputs.push(outputs.reduce((sum,a) => sum+a, 0) / outputs.length);
				chartItems.inputs.push(this.#normalize(inputs).reduce((sum,a) => sum+a, 0) / inputs.length);
			});

			chart[0].data.push([
				i,
				chartItems.grossbergWeights.reduce((sum, a) => sum+a, 0) / chartItems.grossbergWeights.length, //средний вес Гроссберга
				chartItems.outputs.reduce((sum,a) => sum+a, 0) / chartItems.outputs.length //средний выход
			]);
			chart[1].data.push([
				i,
				chartItems.cohonenWeights.reduce((sum, a) => sum+a, 0) / chartItems.cohonenWeights.length, //средний вес Кохонена
				chartItems.inputs.reduce((sum,a) => sum+a,0) / chartItems.inputs.length //средний вход (нормализованный)
			]);
		}

		return chart;
	}
}

class Hamming extends NeuralNetwork {

	init({ input_cnt, output_cnt }) { //начальная инициализация
		const defineWeight = _ => { //чем заполнить начальные веса
			return null;
		};

		const layers = this.layers;
		const hiddenLayer = new Layer(output_cnt);
		hiddenLayer.init(input_cnt, defineWeight);
		layers.push(hiddenLayer);

		const outputLayer = new OutputLayer(output_cnt);
		outputLayer.init(layers[layers.length - 1].cnt, defineWeight);
		layers.push(outputLayer);
	}

	train(data) {
		
		data.forEach( ({inputs, outputs}) => {
			const indexAnswer = outputs.indexOf(1); //индекс ответа
			this._hamming(inputs, indexAnswer, outputs.length);
		});
	}

	_hamming(inputs,j,outputs_cnt) {
		const layers = this.layers;
		const epsilon = -(1/outputs_cnt)+0.001;

		layers[0].weights[j] = layers[0].weights[j].map( (weight,i) => { //рассчет весов первого слоя
			return inputs[i]/2;
		});
		layers[1].weights[j] = layers[1].weights[j].map( (weight,i) => { //рассчет весов слоя категорий
			return (i === j) ? 1 : epsilon;
		});
	}

	run(inputs) {
		const thresholdFunc = (activates) => { //пороговая функция
			return activates.map( x => {
				if (x <= 0) {
					return 0;
				} else if (x >= T) {
					return T;
				} else {
					return x;
				}
			});
		};

		const reduceOutput = (vector) => { //преобразовывает выходной вектор
			return vector.map( x => {
				if (x <= 0) return 0;
				else return 1;
			});
		}

		const calcActivate = (inputs,lay) => { //рассчет активации нейронов в слое
			const activates = [];
			const { cnt, weights} = lay; //количество нейронов в слое; веса

			for (let i=0; i<cnt; i++) {
				const net = math.multiply(inputs,weights[i]); //умножение инпутов и весов
				activates.push(net);
			}

			return thresholdFunc(activates);
		};

		const T = inputs.length / 2;
		const layers = this.layers;

		let activates = calcActivate(inputs, layers[0]); //активации первого слоя
		let lengthVector;
		let cnt = 0; //количество итераций

		do {
			const newActivates = calcActivate(activates, layers[1]); //активации после категорий

			const diffVector = //разность векторов
				math.add(newActivates,math.multiply(activates,-1))
					.map( val => val*val);
			lengthVector = diffVector.reduce((sum,a) => sum+a, 0) ** 0.5; //норма вектора

			activates = newActivates;
			cnt += 1;

		} while (lengthVector > 0.1);

		return reduceOutput(activates);
	}
}

class BAM extends NeuralNetwork {
	
	init({input_cnt, output_cnt}) {
		const defineWeight = _ => 0; //какими значениями инициализировать начальные веса
		
		const layers = this.layers;
		const input_lay = new Layer(input_cnt);
		input_lay.init(output_cnt, defineWeight);
		layers.push(input_lay);
	}

	train(db) {
		let W = this.layers[0].weights;
		db.forEach(({A,B}) => {
			const At = math.transpose(A);
			const multiply = math.multiply(At,B); //умножение транспонированной входной матрицы А и выходной B
			W = math.add(W,multiply); //нахождение суммы умножений матриц (входной А и выходной B) обучающей выборки
		});

		this.layers[0].weights = W;

	}

	run(A) {

		const calcVectors = (vector, W, Wt) => {
			const newA = math.multiply(vector, Wt); //нахождение нового вектора A
			const newB = math.multiply(newA, W); //нахождение нового вектора B
			return [newA.map(vector => this.#sigmoid(vector)), newB.map(vector => this.#sigmoid(vector))];
		};

		const arraysEqual = ([a],[b]) => {
			for (let i=0; i<a.length; i++) {
				if (a[i] !== b[i]) return false;
			}

			return true;
		};

		console.log(A.map(vector => this.#sigmoid(vector))); //лог входного вектора А
		let cnt = 0;

		let W = this.layers[0].weights; //веса
		let Wt = math.transpose(W); //транспонированная матрица весов

		let B, newA, newB;
		if (A.flat().length === 20) {
			[W, Wt] = [Wt, W];
		}

		B = math.multiply(A,W).map(vector => this.#sigmoid(vector)); //первое вычисление B
		[ newA, newB ] = calcVectors(B, W, Wt); //новые вычисления A и B

		while (!arraysEqual(A, newA) && !arraysEqual(B, newB)) { //проверка на эквиваленцию
			A = newA;
			B = newB;
			[newA, newB] = calcVectors(B, W, Wt);

			cnt += 1;
		}
		
		console.log(cnt); //количество итераций для нахождения эквиваленции
		console.log(newB); //лог выходного вектора B, ассоциированного с А

		return newB;
	}


	#threshold(vector) { //пороговая функция
		return vector.map(val => {
			if (val > 0) return 1;
			else if (val < 0) return 0;
			else if (val === 0) return 0;
		});
	}

	#sigmoid(vector) { //сигмоида
		return vector.map(x => {
			return 1/(1+math.exp(-x));
		});
	}

}

module.exports.NeuralNetwork_BackProp = NeuralNetwork_BackProp;
module.exports.NeuralNetwork_CounterProp = NeuralNetwork_CounterProp;
module.exports.Hamming = Hamming;
module.exports.BAM = BAM;