# Solar_system-planets
![Quart](https://img.shields.io/badge/Framework-Quart-purple)

This repository explains the orbits of the first 8 planets in the solar system using newtonian physiscs (classical mechanics) with a bit of Post-Newtonian corrections (theory of relativity).
Deeper explaination coming soon!

## Description

Equations used:

* The gravitational equation:

$$
F_G = \frac{m_1*m_2}{r^2}
$$


* Vectorized graviational equation (Computes the vector of the gravity force of the first object influenced by the second)
$$
\overrightarrow{\text{G}} = F_G * \hat{r}
$$

Where $\hat{r} = \overrightarrow{\text{r}}/r$ is the unit direction vector of the one object to another


## Getting Started

* Firstly, clone the repository by running this command:

```git clone https://github.com/Peter-8310/Solar_system-planets```

* Then, enter the directory:

```cd Solar_system-planets```

### Dependencies

* The entire project runs on Python, so only Python is needed
* To install the libraries needed to run the program, please run the following command:

```python -m pip install -r requirements.txt```

### Executing program

* Make sure the libraries are installed
* Run the following command
```python app.py```
* Go to http://127.0.0.1:5000 on your favorite browser
* Enjoy the show!



## Author

Peter Bui  
[@Peter-8310](https://github.com/Peter-8310)



## License

This project is licensed under the MIT License - see the LICENSE.md file for details

